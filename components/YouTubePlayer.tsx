'use client'

import { useState, useEffect, useRef } from 'react'
import YouTube from 'youtube-player'
import { isMobileDevice } from '@/lib/mobileUtils'
import styles from './YouTubePlayer.module.css'

interface YouTubePlayerProps {
  videoId: string | null
  isPlaying: boolean
  syncTime: number
  onVideoChange: (videoId: string | null) => void
  onPlayStateChange: (isPlaying: boolean) => void
  onTimeUpdate: (time: number) => void
}

export default function YouTubePlayerComponent({
  videoId,
  isPlaying,
  syncTime,
  onVideoChange,
  onPlayStateChange,
  onTimeUpdate,
}: YouTubePlayerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const youtubePlayerRef = useRef<any>(null)

  useEffect(() => {
    // Initialize player even if no videoId yet
    if (playerRef.current && !youtubePlayerRef.current) {
      try {
        // Detect mobile device
        const isMobile = isMobileDevice()
        
        youtubePlayerRef.current = YouTube(playerRef.current, {
          width: '100%',
          height: isMobile ? '250' : '315',
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            playsinline: 1, // Important for iOS
            rel: 0,
            fs: 1,
            cc_load_policy: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
          },
        })

      // Wait for player to be ready
      youtubePlayerRef.current.on('ready', () => {
        console.log('YouTube player ready')
        setPlayerReady(true)
        setPlayerError(null)
      })

      youtubePlayerRef.current.on('error', (event: any) => {
        console.error('YouTube player error:', event)
        setPlayerError('Failed to load video. Please try another video.')
      })

      youtubePlayerRef.current.on('stateChange', (event: any) => {
        const state = event.data
        console.log('YouTube player state:', state)
        // State 1 = playing, 2 = paused, 0 = ended, 3 = buffering, 5 = cued
        if (state === 1) {
          onPlayStateChange(true)
        } else if (state === 0 || state === 2) {
          onPlayStateChange(false)
        }
      })

      // Update time periodically
      const timeInterval = setInterval(async () => {
        if (youtubePlayerRef.current) {
          try {
            const currentTime = await youtubePlayerRef.current.getCurrentTime()
            onTimeUpdate(currentTime)
          } catch (error) {
            // Ignore errors
          }
        }
      }, 1000)

        return () => {
          clearInterval(timeInterval)
          if (youtubePlayerRef.current) {
            youtubePlayerRef.current.destroy()
            youtubePlayerRef.current = null
            setPlayerReady(false)
          }
        }
      } catch (error: any) {
        console.error('Error initializing YouTube player:', error)
        setPlayerError('Failed to initialize YouTube player. Please refresh the page.')
      }
    }
  }, [onPlayStateChange, onTimeUpdate])

  useEffect(() => {
    if (youtubePlayerRef.current && videoId && playerReady) {
      console.log('Loading video:', videoId)
      youtubePlayerRef.current.loadVideoById(videoId).catch((error: any) => {
        console.error('Error loading video:', error)
        setPlayerError('Failed to load video. Please try again.')
      })
    } else if (youtubePlayerRef.current && videoId && !playerReady) {
      // Wait for player to be ready
      const checkReady = setInterval(() => {
        if (playerReady && youtubePlayerRef.current) {
          clearInterval(checkReady)
          youtubePlayerRef.current.loadVideoById(videoId).catch((error: any) => {
            console.error('Error loading video:', error)
            setPlayerError('Failed to load video. Please try again.')
          })
        }
      }, 100)
      return () => clearInterval(checkReady)
    }
  }, [videoId, playerReady])

  useEffect(() => {
    if (youtubePlayerRef.current && playerReady && videoId) {
      if (isPlaying) {
        console.log('Playing video')
        youtubePlayerRef.current.playVideo().catch((error: any) => {
          console.error('Error playing video:', error)
          // Autoplay might be blocked - show message
          if (error.message?.includes('autoplay') || error.message?.includes('play')) {
            setPlayerError('Autoplay blocked. Please click play on the video player.')
          }
        })
      } else {
        console.log('Pausing video')
        youtubePlayerRef.current.pauseVideo().catch((error: any) => {
          console.error('Error pausing video:', error)
        })
      }
    }
  }, [isPlaying, playerReady, videoId])

  useEffect(() => {
    if (youtubePlayerRef.current && syncTime > 0) {
      youtubePlayerRef.current.seekTo(syncTime, true)
    }
  }, [syncTime])

  const searchYouTube = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      // Using YouTube Data API v3
      const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || 'YOUR_API_KEY'

      if (API_KEY === 'YOUR_API_KEY') {
        alert('Please configure your YouTube API key in .env.local file. See README for instructions.')
        setIsSearching(false)
        return
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          searchQuery
        )}&type=video&maxResults=10&key=${API_KEY}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to search YouTube')
      }

      const data = await response.json()
      setSearchResults(data.items || [])
    } catch (error: any) {
      console.error('Error searching YouTube:', error)
      alert(`Error searching YouTube: ${error.message || 'Please check your API key and try again.'}`)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const selectVideo = (video: any) => {
    const id = video.id.videoId
    onVideoChange(id)
    setSearchQuery('')
    setSearchResults([])
    setPlayerError(null)
  }

  const handleManualPlay = async () => {
    if (youtubePlayerRef.current && videoId) {
      try {
        await youtubePlayerRef.current.playVideo()
        onPlayStateChange(true)
      } catch (error: any) {
        console.error('Manual play error:', error)
        setPlayerError('Could not play video. Please check your internet connection and try again.')
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search for music on YouTube..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && searchYouTube()}
            className={styles.searchInput}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button onClick={searchYouTube} disabled={isSearching} className={styles.searchButton}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className={styles.results}>
            <h4>Search Results:</h4>
            <ul className={styles.resultsList}>
              {searchResults.map((video: any) => (
                <li key={video.id.videoId} className={styles.resultItem} onClick={() => selectVideo(video)}>
                  <img
                    src={video.snippet.thumbnails.default.url}
                    alt={video.snippet.title}
                    className={styles.thumbnail}
                  />
                  <div className={styles.resultInfo}>
                    <div className={styles.resultTitle}>{video.snippet.title}</div>
                    <div className={styles.resultChannel}>{video.snippet.channelTitle}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.playerSection}>
        {playerError && (
          <div className={styles.errorMessage}>
            <p>⚠️ {playerError}</p>
            <button onClick={() => setPlayerError(null)} className={styles.dismissButton}>
              Dismiss
            </button>
          </div>
        )}
        {/* Always render player container for initialization */}
        <div ref={playerRef} className={styles.player} style={{ display: videoId ? 'block' : 'none' }}></div>
        {!videoId && (
          <div className={styles.placeholder}>
            <p>🎵 Search and select a video to start playing</p>
          </div>
        )}
        {videoId && !playerReady && (
          <div className={styles.loadingMessage}>
            <p>Loading player...</p>
          </div>
        )}
        {videoId && playerReady && !isPlaying && (
          <div className={styles.playHint}>
            <p>💡 Click the play button on the video player to start playback</p>
            <button onClick={handleManualPlay} className={styles.manualPlayButton}>
              ▶️ Play Video
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

