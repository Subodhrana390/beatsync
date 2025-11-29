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
  },
});

// Room-based system
let rooms = {}; // roomId -> { syncState, clients: Set() }
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
        isSyncing: false,
      },
      clients: new Set(),
    };
    console.log(`Room ${roomId} created`);
  }
  return rooms[roomId];
}

function joinRoom(socket, roomId) {
  const room = createRoom(roomId);
  socket.join(roomId);
  room.clients.add(socket.id);
  console.log(`Client ${socket.id} joined room ${roomId}. Room clients: ${room.clients.size}`);

  // Send current sync state to newly connected client
  socket.emit('syncState', room.syncState);
  socket.emit('roomJoined', { roomId, clientCount: room.clients.size });

  return room;
}

function leaveRoom(socket, roomId) {
  if (rooms[roomId]) {
    rooms[roomId].clients.delete(socket.id);
    socket.leave(roomId);
    console.log(`Client ${socket.id} left room ${roomId}. Room clients: ${rooms[roomId].clients.size}`);

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
        isSyncing: true,
      };
      io.to(roomId).emit('syncAll', room.syncState);
      console.log(`Room ${roomId} - Sync started:`, room.syncState);
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
        isSyncing: true,
      };
      io.to(roomId).emit('syncAll', room.syncState);
      console.log(`Room ${roomId} - Sync all:`, room.syncState);
    }
  });

  socket.on('playStateChange', (data) => {
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      const room = rooms[roomId];
      if (room.syncState.isSyncing) {
        room.syncState.isPlaying = data.isPlaying;
        room.syncState.currentTime = data.time || 0;
        socket.to(roomId).emit('syncPlay', {
          videoId: data.videoId,
          time: data.time,
          isPlaying: data.isPlaying,
        });
      }
    }
  });

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`Client disconnected. Total clients: ${connectedClients}`);

    // Remove client from any room they were in
    const roomId = Object.keys(rooms).find(roomId => rooms[roomId].clients.has(socket.id));
    if (roomId) {
      leaveRoom(socket, roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Sync server running on port ${PORT}`);
});

