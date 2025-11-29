# BeatSync - Multi-Device Bluetooth Speaker Sync

A Next.js application that synchronizes music playback across multiple phones connected to Bluetooth speakers, with YouTube integration.

## Features

- 🎵 YouTube music playback
- 📱 Multi-device synchronization
- 🔊 Bluetooth speaker support
- ⚡ Real-time audio sync
- 🎛️ Centralized playback control

## Getting Started

### Prerequisites

- Node.js 18+ installed
- YouTube Data API v3 key (get one from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key_here
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

3. Start the sync server (in one terminal):
```bash
npm run server
```

4. Start the Next.js development server (in another terminal):
```bash
npm run dev
```

Or run both simultaneously:
```bash
npm run dev:all
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

**Note:** For Web Bluetooth to work, you need to access the app via HTTPS or localhost. For production, deploy with HTTPS enabled.

## How It Works

1. **Open the App**: Open the app on multiple devices (phones/tablets/computers)
2. **Select Audio Output** (Optional): Use the Audio Output selector to choose your preferred audio device (Bluetooth speaker, built-in speakers, headphones, etc.)
3. **Connect Bluetooth** (Optional): If you want to use Bluetooth speakers, connect them via system settings first, then select them in the Audio Output section
4. **Search Music**: Use the YouTube Player to search for music
5. **Start Sync**: Click "Start Sync" to begin synchronized playback
6. **Control Playback**: All devices will play in perfect sync through their selected audio output devices

**Note**: Bluetooth connection is completely optional. The app works with any audio output device!

### Audio Output Routing

The app includes an Audio Output Selector that allows you to choose any audio output device:

- **Chrome/Edge**: Supports `setSinkId()` API for routing audio to specific output devices (Bluetooth speakers, headphones, built-in speakers, etc.)
- **YouTube Iframe**: Direct audio routing to YouTube iframes is limited by CORS, but the system default audio output will be used
- **Fallback**: If browser doesn't support audio routing, users should select their preferred audio output device in their system settings
- **No Bluetooth Required**: The app works perfectly with built-in speakers, wired headphones, or any other audio output device

## Architecture

- **Frontend**: Next.js app with React components
- **Sync Server**: Node.js/Express server with Socket.io for real-time synchronization
- **Bluetooth**: Web Bluetooth API for device connection
- **YouTube**: YouTube Data API v3 for search, YouTube IFrame API for playback

## Requirements

- Modern browser (Chrome, Edge, Firefox, Safari)
- HTTPS connection (required for Web Bluetooth, if using Bluetooth features)
- Multiple devices (phones/tablets/computers) - Bluetooth speakers are optional

## Deployment

### Quick Deploy to Vercel

1. **Deploy Sync Server** (Railway/Render/Heroku):
   - Deploy `server/` directory to a hosting service that supports WebSockets
   - Copy the server URL

2. **Deploy Next.js App to Vercel**:
   - Push code to GitHub
   - Import project in Vercel dashboard
   - Add environment variables:
     - `NEXT_PUBLIC_YOUTUBE_API_KEY`
     - `NEXT_PUBLIC_SOCKET_URL` (your sync server URL)
   - Deploy!

📖 **Full deployment guide**: See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

## Tech Stack

- Next.js 14
- TypeScript
- Socket.io for real-time synchronization
- YouTube Player API
- Web Bluetooth API

