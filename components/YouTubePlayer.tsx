'use client'

import { useState, useEffect, useRef } from 'react'
import YouTube from 'youtube-player'
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
  const playerRef = useRef<HTMLDivElement>(null)
  const youtubePlayerRef = useRef<any>(null)

  useEffect(() => {
    if (playerRef.current && !youtubePlayerRef.current) {
      youtubePlayerRef.current = YouTube(playerRef.current, {
        width: '100%',
        height: '315',
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
        },
      })

      youtubePlayerRef.current.on('stateChange', (event: any) => {
        const state = event.data
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
        }
      }
    }
  }, [onPlayStateChange, onTimeUpdate])

  useEffect(() => {
    if (youtubePlayerRef.current && videoId) {
      youtubePlayerRef.current.loadVideoById(videoId)
    }
  }, [videoId])

  useEffect(() => {
    if (youtubePlayerRef.current) {
      if (isPlaying) {
        youtubePlayerRef.current.playVideo()
      } else {
        youtubePlayerRef.current.pauseVideo()
      }
    }
  }, [isPlaying])

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
        {videoId ? (
          <div ref={playerRef} className={styles.player}></div>
        ) : (
          <div className={styles.placeholder}>
            <p>🎵 Search and select a video to start playing</p>
          </div>
        )}
      </div>
    </div>
  )
}

