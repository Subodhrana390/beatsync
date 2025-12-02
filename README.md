# BeatSync - Multi-Device Audio Sync

A Next.js application that synchronizes music playback across multiple devices, with YouTube integration and flexible audio output support.

## Features

- 🎵 YouTube music playback
- 📱 Multi-device synchronization (Wi-Fi or Mobile Hotspot)
- 🔊 Flexible audio output support
- ⚡ Real-time audio sync
- 🎛️ Centralized playback control
- 📶 Flexible network connectivity

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

1. **Choose Connection Method**: Use same Wi-Fi network OR same mobile hotspot
2. **Open the App**: Open the app on multiple devices (phones/tablets/computers)
3. **Configure Audio Output**: Use system settings to select your preferred audio device (speakers, headphones, etc.)
4. **Search Music**: Use the YouTube Player to search for music
5. **Start Sync**: Click "Start Sync" to begin synchronized playback
6. **Control Playback**: All devices will play in perfect sync through their configured audio outputs

**Note**: Audio output is configured through your device's system settings. The app works with any connected audio device!

### Connection Methods

BeatSync supports two connection methods for device synchronization:

#### 🏠 Wi-Fi Network
- All devices connect to the same home/office Wi-Fi network
- Most stable and reliable connection
- Best for large groups and extended use
- Server IP typically starts with 192.168.x.x or 10.x.x.x

#### 📶 Mobile Hotspot
- One mobile device creates a hotspot that others connect to
- Perfect for outdoor use or when Wi-Fi isn't available
- Supports 5-10 connected devices (depending on phone model)
- Server IP typically starts with 192.168.43.x or 172.20.10.x

**Both methods provide identical synchronization quality!**

### Audio Output Configuration

The app works with your system's audio output configuration:

- **Desktop Browsers**: The Audio Output Selector allows programmatic routing to specific devices (speakers, headphones, etc.)
- **Mobile Devices**: Audio output is controlled through system settings due to browser security restrictions
- **System Integration**: All audio devices connected to your system are supported
- **No Special Setup**: Works with built-in speakers, external speakers, headphones, or any audio output device

## Architecture

- **Frontend**: Next.js app with React components
- **Sync Server**: Node.js/Express server with Socket.io for real-time synchronization
- **Bluetooth**: Web Bluetooth API for device connection
- **YouTube**: YouTube Data API v3 for search, YouTube IFrame API for playback

## Requirements

- Modern browser (Chrome, Edge, Firefox, Safari)
- HTTPS connection (recommended for production)
- Multiple devices (phones/tablets/computers)
- Audio output device (speakers, headphones, etc.)
- Network connectivity: Same Wi-Fi network OR same mobile hotspot

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

- Next.js 14 (JavaScript)
- Socket.io for real-time synchronization
- YouTube Player API
- Audio Output API (where supported)
- Mobile hotspot networking support

