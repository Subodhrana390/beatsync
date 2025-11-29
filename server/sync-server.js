const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

let connectedClients = 0;
let syncState = {
  videoId: null,
  isPlaying: false,
  currentTime: 0,
  isSyncing: false,
};

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`Client connected. Total clients: ${connectedClients}`);
  io.emit('clientCount', connectedClients);

  // Send current sync state to newly connected client
  socket.emit('syncState', syncState);

  socket.on('startSync', (data) => {
    syncState = {
      videoId: data.videoId,
      isPlaying: data.isPlaying,
      currentTime: data.time || 0,
      isSyncing: true,
    };
    io.emit('syncAll', syncState);
    console.log('Sync started:', syncState);
  });

  socket.on('stopSync', () => {
    syncState.isSyncing = false;
    io.emit('syncStop');
    console.log('Sync stopped');
  });

  socket.on('syncAll', (data) => {
    syncState = {
      videoId: data.videoId,
      isPlaying: data.isPlaying,
      currentTime: data.time || 0,
      isSyncing: true,
    };
    io.emit('syncAll', syncState);
    console.log('Sync all:', syncState);
  });

  socket.on('playStateChange', (data) => {
    if (syncState.isSyncing) {
      syncState.isPlaying = data.isPlaying;
      syncState.currentTime = data.time || 0;
      socket.broadcast.emit('syncPlay', {
        videoId: data.videoId,
        time: data.time,
        isPlaying: data.isPlaying,
      });
    }
  });

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`Client disconnected. Total clients: ${connectedClients}`);
    io.emit('clientCount', connectedClients);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Sync server running on port ${PORT}`);
});

