# Deploying BeatSync to Vercel

This guide will help you deploy the BeatSync app to Vercel. Note that the app has two parts:
1. **Next.js Frontend** - Deploys to Vercel
2. **Socket.io Sync Server** - Needs separate deployment (see options below)

## Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Node.js 18+ installed locally (for testing)

## Step 1: Deploy Sync Server First

The sync server needs to run separately. Choose one of these options:

### Option A: Deploy to Railway (Recommended)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your beatsync repository
4. Add a new service → "Empty Service"
5. In the service settings:
   - **Root Directory**: `/server`
   - **Start Command**: `node sync-server.js`
   - **Port**: Set to `3001` (or use Railway's PORT env var)
6. Add environment variable:
   - `PORT=3001`
7. Deploy and copy the Railway URL (e.g., `https://your-app.railway.app`)

### Option B: Deploy to Render

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Root Directory**: `server`
   - **Build Command**: (leave empty)
   - **Start Command**: `node sync-server.js`
   - **Environment**: Node
   - **Port**: `3001`
5. Deploy and copy the Render URL

### Option C: Deploy to Heroku

1. Install Heroku CLI
2. Create `Procfile` in `server/` directory:
   ```
   web: node sync-server.js
   ```
3. Deploy:
   ```bash
   cd server
   heroku create your-app-name
   git subtree push --prefix server heroku main
   ```

### Option D: Use a VPS (DigitalOcean, AWS, etc.)

Deploy the server to any VPS that supports Node.js and WebSockets.

## Step 2: Deploy Next.js App to Vercel

### Method 1: Deploy via Vercel Dashboard (Easiest)

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Go to Vercel Dashboard**:
   - Visit [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub repository

3. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Add Environment Variables**:
   - Click "Environment Variables"
   - Add the following:
     ```
     NEXT_PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key_here
     NEXT_PUBLIC_SOCKET_URL=https://your-sync-server-url.com
     ```
   - Replace `your-sync-server-url.com` with your deployed sync server URL from Step 1

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-app.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked for environment variables, add:
     - `NEXT_PUBLIC_YOUTUBE_API_KEY`
     - `NEXT_PUBLIC_SOCKET_URL`

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

## Step 3: Update Sync Server CORS (If Needed)

If your sync server is on a different domain, make sure CORS is configured correctly. The server already has CORS enabled, but you may want to restrict it:

```javascript
// In server/sync-server.js
const io = new Server(server, {
  cors: {
    origin: ['https://your-app.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});
```

## Step 4: Test Your Deployment

1. Visit your Vercel deployment URL
2. Open the app on multiple devices
3. In the "Sync Control" section, enter your sync server URL
4. Test the connection and sync functionality

## Environment Variables Summary

### Vercel (Next.js App):
- `NEXT_PUBLIC_YOUTUBE_API_KEY` - Your YouTube Data API v3 key
- `NEXT_PUBLIC_SOCKET_URL` - Your deployed sync server URL

### Sync Server:
- `PORT` - Server port (default: 3001)

## Troubleshooting

### Issue: Can't connect to sync server
- **Solution**: Make sure the sync server is running and accessible
- Check CORS settings on the sync server
- Verify the `NEXT_PUBLIC_SOCKET_URL` environment variable is correct

### Issue: Build fails on Vercel
- **Solution**: Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript types are installed

### Issue: WebSocket connection fails
- **Solution**: Some hosting providers don't support WebSockets
- Use Railway, Render, or a VPS for the sync server
- Check if your sync server provider supports WebSockets

## Production Checklist

- [ ] Sync server deployed and accessible
- [ ] Environment variables set in Vercel
- [ ] YouTube API key configured
- [ ] CORS configured on sync server
- [ ] Tested multi-device sync
- [ ] Custom domain configured (optional)

## Next Steps

- Set up a custom domain in Vercel
- Configure automatic deployments from GitHub
- Set up monitoring and error tracking
- Consider using Vercel's Edge Functions for better performance

## Cost Considerations

- **Vercel**: Free tier available (Hobby plan)
- **Railway**: Free tier with $5 credit/month
- **Render**: Free tier available (with limitations)
- **Heroku**: Paid plans only (no free tier)

For production use, consider the Pro plans for better performance and reliability.

