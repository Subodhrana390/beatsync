# Quick Vercel Deployment Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Deploy Sync Server to Railway (Free)

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `beatsync` repository
4. Add service → "Empty Service"
5. Settings:
   - **Root Directory**: `server`
   - **Start Command**: `node sync-server.js`
6. Deploy → Copy the URL (e.g., `https://your-app.railway.app`)

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click "Add New Project"
3. Import your `beatsync` repository
4. **Environment Variables** (click "Environment Variables"):
   ```
   NEXT_PUBLIC_YOUTUBE_API_KEY = your_youtube_api_key
   NEXT_PUBLIC_SOCKET_URL = https://your-app.railway.app
   ```
5. Click "Deploy"
6. Done! 🎉

## 📝 Environment Variables Needed

In Vercel dashboard → Your Project → Settings → Environment Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | `your_key_here` | YouTube Data API v3 key |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-server.railway.app` | Your sync server URL |

## ✅ That's It!

Your app will be live at `https://your-app.vercel.app`

For detailed instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

