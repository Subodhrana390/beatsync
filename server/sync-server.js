const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// API endpoints
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];

  if (room) {
    res.json({
      roomId: roomId.toUpperCase(),
      clientCount: room.clients.size,
      isActive: room.syncState.isSyncing,
      videoId: room.syncState.videoId,
    });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

app.get('/api/rooms', (req, res) => {
  const roomInfo = Object.keys(rooms).map(roomId => ({
    roomId,
    clientCount: rooms[roomId].clients.size,
    isActive: rooms[roomId].syncState.isSyncing,
    videoId: rooms[roomId].syncState.videoId,
  }));

  res.json({ rooms: roomInfo });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Room-based system
let rooms = {}; // roomId -> { syncState, clients: Map(), readyClients: Set() }
let connectedClients = 0;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      syncState: {
        videoId: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        isSyncing: false,
      },
      clients: new Map(), // clientId -> { id, connectedAt, lastSeen, userAgent }
      readyClients: new Set(), // Track which clients are ready to play
    };
    console.log(`Room ${roomId} created`);
  }
  return rooms[roomId];
}

function joinRoom(socket, roomId) {
  const room = createRoom(roomId);
  socket.join(roomId);

  // Store client information
  room.clients.set(socket.id, {
    id: socket.id,
    connectedAt: new Date(),
    lastSeen: new Date(),
    userAgent: socket.handshake.headers['user-agent']?.substring(0, 50) + '...' || 'Unknown',
    ready: false
  });

  console.log(`Client ${socket.id} joined room ${roomId}. Room clients: ${room.clients.size}`);

  // Send current sync state to newly connected client
  socket.emit('syncState', room.syncState);

  // Send detailed client list to all clients in the room
  broadcastClientList(roomId);

  // Send room joined confirmation with client count
  socket.emit('roomJoined', { roomId, clientCount: room.clients.size });

  return room;
}

function broadcastClientList(roomId) {
  if (rooms[roomId]) {
    const room = rooms[roomId];
    const clientList = Array.from(room.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      lastSeen: client.lastSeen,
      userAgent: client.userAgent,
      ready: room.readyClients.has(client.id)
    }));

    io.to(roomId).emit('clientListUpdate', {
      clients: clientList,
      readyCount: room.readyClients.size,
      totalCount: room.clients.size
    });
  }
}

function leaveRoom(socket, roomId) {
  if (rooms[roomId]) {
    rooms[roomId].clients.delete(socket.id);
    rooms[roomId].readyClients.delete(socket.id); // Also remove from ready clients
    socket.leave(roomId);
    console.log(`Client ${socket.id} left room ${roomId}. Room clients: ${rooms[roomId].clients.size}`);

    // Broadcast updated client list
    if (rooms[roomId].clients.size > 0) {
      broadcastClientList(roomId);

      // Also update ready state
      io.to(roomId).emit('readyStateUpdate', {
        readyCount: rooms[roomId].readyClients.size,
        totalCount: rooms[roomId].clients.size,
        allReady: rooms[roomId].readyClients.size === rooms[roomId].clients.size
      });
    }

    // If room is empty, clean it up
    if (rooms[roomId].clients.size === 0) {
      delete rooms[roomId];
      console.log(`Room ${roomId} deleted (empty)`);
    }
  }
}

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`Client connected. Total clients: ${connectedClients}`);
  console.log(`Client details:`, {
    id: socket.id,
    transport: socket.conn.transport.name,
    address: socket.handshake.address,
    userAgent: socket.handshake.headers['user-agent']?.substring(0, 50) + '...'
  });

  socket.on('createRoom', () => {
    const roomId = generateRoomCode();
    joinRoom(socket, roomId);
  });

  socket.on('joinRoom', (roomId) => {
    if (roomId && typeof roomId === 'string') {
      joinRoom(socket, roomId.toUpperCase());
    }
  });

  socket.on('startSync', (data) => {
    // Find which room this socket is in
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      room.syncState = {
        videoId: data.videoId,
        isPlaying: data.isPlaying,
        currentTime: data.time || 0,
        duration: data.duration || 0,
        isSyncing: true,
      };
      // Include timestamp in the broadcast for latency compensation
      const syncData = {
        ...room.syncState,
        timestamp: data.timestamp || Date.now()
      };
      io.to(roomId).emit('syncAll', syncData);
      console.log(`Room ${roomId} - Sync started:`, syncData);
    }
  });

  socket.on('stopSync', () => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      room.syncState.isSyncing = false;
      io.to(roomId).emit('syncStop');
      console.log(`Room ${roomId} - Sync stopped`);
    }
  });

  socket.on('syncAll', (data) => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      room.syncState = {
        videoId: data.videoId,
        isPlaying: data.isPlaying,
        currentTime: data.time || 0,
        duration: data.duration || 0,
        isSyncing: true,
      };
      // Include timestamp in the broadcast for latency compensation
      const syncData = {
        ...room.syncState,
        timestamp: data.timestamp || Date.now()
      };
      io.to(roomId).emit('syncAll', syncData);
      console.log(`Room ${roomId} - Sync all:`, syncData);
    }
  });

  socket.on('syncWhenReady', (data) => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      // Set the desired sync state but don't start yet
      room.syncState = {
        videoId: data.videoId,
        isPlaying: false, // Will be set to true when all are ready
        currentTime: data.time || 0,
        duration: data.duration || 0,
        isSyncing: false, // Will be set to true when all are ready
      };

      console.log(`Room ${roomId} - Sync when ready requested. Ready clients: ${room.readyClients.size}/${room.clients.size}`);

      // Check if all clients are ready
      if (room.readyClients.size === room.clients.size && room.clients.size > 0) {
        // All clients are ready, start sync immediately
        room.syncState.isPlaying = true;
        room.syncState.isSyncing = true;
        const syncData = {
          ...room.syncState,
          timestamp: data.timestamp || Date.now()
        };
        io.to(roomId).emit('syncAll', syncData);
        console.log(`Room ${roomId} - All clients ready, starting sync:`, syncData);
      } else {
        // Not all clients ready yet, notify them to prepare
        io.to(roomId).emit('prepareSync', {
          videoId: data.videoId,
          time: data.time || 0,
          duration: data.duration || 0
        });
        console.log(`Room ${roomId} - Waiting for all clients to be ready before starting sync`);
      }
    }
  });

  socket.on('playStateChange', (data) => {
    console.log(`📡 Server: Received playStateChange from ${socket.id}:`, {
      time: data.time,
      isPlaying: data.isPlaying,
      videoId: data.videoId?.substring(0, 11) + '...'
    });

    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      // Always update the room state, but only broadcast if syncing or if it's just a seek/time change
      room.syncState.isPlaying = data.isPlaying;
      room.syncState.currentTime = data.time || 0;
      room.syncState.duration = data.duration || room.syncState.duration;

      console.log(`📤 Server: Broadcasting syncPlay to ${room.clients.size - 1} other clients in room ${roomId}`);

      // Broadcast to other clients in the room (for seek synchronization)
      socket.to(roomId).emit('syncPlay', {
        videoId: data.videoId,
        time: data.time,
        duration: room.syncState.duration,
        isPlaying: data.isPlaying,
      });

      console.log(`✅ Server: syncPlay broadcast complete for room ${roomId}`);
    } else {
      console.log(`❌ Server: Client ${socket.id} not found in any room`);
    }
  });

  socket.on('volumeChange', (data) => {
    console.log(`🔊 Server: Received volumeChange from ${socket.id}:`, {
      volume: data.volume,
      muted: data.muted
    });

    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      console.log(`📤 Server: Broadcasting volumeChange to ${rooms[roomId].clients.size - 1} other clients in room ${roomId}`);

      // Broadcast to other clients in the room
      socket.to(roomId).emit('volumeChange', {
        volume: data.volume,
        muted: data.muted,
      });

      console.log(`✅ Server: volumeChange broadcast complete for room ${roomId}`);
    } else {
      console.log(`❌ Server: Client ${socket.id} not found in any room for volumeChange`);
    }
  });

  socket.on('clientReady', () => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      room.readyClients.add(socket.id);

      // Update client ready status
      const client = room.clients.get(socket.id);
      if (client) {
        client.ready = true;
        client.lastSeen = new Date();
      }

      console.log(`Client ${socket.id} ready in room ${roomId}. Ready clients: ${room.readyClients.size}/${room.clients.size}`);

      // Check if all clients are now ready and there's a video to sync
      const allReady = room.readyClients.size === room.clients.size;
      const hasVideo = room.syncState.videoId && room.syncState.currentTime >= 0;

      // Broadcast updated client list and ready state
      broadcastClientList(roomId);
      io.to(roomId).emit('readyStateUpdate', {
        readyCount: room.readyClients.size,
        totalCount: room.clients.size,
        allReady: allReady
      });

      // If all clients are ready and there's a pending sync, start it
      if (allReady && hasVideo && !room.syncState.isSyncing) {
        room.syncState.isPlaying = true;
        room.syncState.isSyncing = true;
        const syncData = {
          ...room.syncState,
          timestamp: Date.now()
        };
        io.to(roomId).emit('syncAll', syncData);
        console.log(`Room ${roomId} - All clients ready, auto-starting pending sync:`, syncData);
      }
    }
  });

  socket.on('clientNotReady', () => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      room.readyClients.delete(socket.id);

      // Update client ready status
      const client = room.clients.get(socket.id);
      if (client) {
        client.ready = false;
        client.lastSeen = new Date();
      }

      console.log(`Client ${socket.id} not ready in room ${roomId}. Ready clients: ${room.readyClients.size}/${room.clients.size}`);

      // Broadcast updated client list and ready state
      broadcastClientList(roomId);
      io.to(roomId).emit('readyStateUpdate', {
        readyCount: room.readyClients.size,
        totalCount: room.clients.size,
        allReady: room.readyClients.size === room.clients.size
      });
    }
  });

  // Heartbeat/ping mechanism to track active clients
  socket.on('heartbeat', () => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const client = rooms[roomId].clients.get(socket.id);
      if (client) {
        client.lastSeen = new Date();
        // Optional: broadcast updated client list if needed
      }
    }
  });

socket.on('disconnect', (reason) => {
  connectedClients--;
  console.log(`Client disconnected. Total clients: ${connectedClients}`);
  console.log(`Disconnect details:`, {
    id: socket.id,
    reason: reason,
    transport: socket.conn?.transport?.name
  });

  // Remove client from any room they were in
  const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
  if (roomId) {
    leaveRoom(socket, roomId);
  }
});

// Periodic cleanup of stale clients (clients that haven't sent heartbeat for 2 minutes)
setInterval(() => {
  const now = new Date();
  const staleThreshold = 2 * 60 * 1000; // 2 minutes

  for (const roomId in rooms) {
    const room = rooms[roomId];
    const staleClients = [];

    for (const [clientId, client] of room.clients) {
      if (now - new Date(client.lastSeen) > staleThreshold) {
        staleClients.push(clientId);
      }
    }

    // Remove stale clients
    for (const clientId of staleClients) {
      console.log(`Removing stale client ${clientId} from room ${roomId}`);
      room.clients.delete(clientId);
      room.readyClients.delete(clientId);

      // Broadcast updated client list
      if (room.clients.size > 0) {
        broadcastClientList(roomId);
      }
    }

    // Clean up empty rooms
    if (room.clients.size === 0) {
      delete rooms[roomId];
      console.log(`Room ${roomId} deleted (empty after cleanup)`);
    }
  }
}, 60000); // Check every minute
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Sync server running on port ${PORT}`);
});

