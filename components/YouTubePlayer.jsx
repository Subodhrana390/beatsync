'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import styles from './YouTubePlayer.module.css'

export default function YouTubePlayer({
  videoId,
  isPlaying,
  syncTime,
  syncTimestamp,
  duration: syncDuration,
  socket,
  roomId,
  onVideoChange,
  onPlayStateChange,
  onTimeUpdate,
  onDurationUpdate,
  onSeek,
  onPlayerReady,
}) {
  const playerRef = useRef(null)
  const containerRef = useRef(null)
  const playerInstanceRef = useRef(null)
  const [ytReady, setYtReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [muted, setMuted] = useState(false)
  const [playerError, setPlayerError] = useState(null)
  const [isSeeking, setIsSeeking] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [nowTitle, setNowTitle] = useState(null)
  const [nowChannel, setNowChannel] = useState(null)
  const [nowThumb, setNowThumb] = useState(null)

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true)
      return
    }

    if (!document.getElementById('youtube-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true)
    }
  }, [])

  // Create player when YouTube API is ready
  useEffect(() => {
    if (!ytReady || !containerRef.current || playerInstanceRef.current) return

    playerInstanceRef.current = new window.YT.Player(containerRef.current, {
      width: '100%',
      height: '360',
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
        enablejsapi: 1,
      },
      events: {
        onReady: () => {
          onPlayerReady?.(true)
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            onPlayStateChange(true)
            // Broadcast real-time play state change
            const currentTime = playerInstanceRef.current.getCurrentTime()
            broadcastPlayStateChange(true, currentTime)
          } else if (event.data === window.YT.PlayerState.PAUSED ||
                     event.data === window.YT.PlayerState.ENDED) {
            onPlayStateChange(false)
            // Broadcast real-time pause state change
            const currentTime = playerInstanceRef.current.getCurrentTime()
            broadcastPlayStateChange(false, currentTime)
          }
        },
        onError: (error) => {
          let errorMessage = 'Video not playable.'
          if (error.data === 2) errorMessage = 'Invalid video ID'
          else if (error.data === 5) errorMessage = 'HTML5 player error'
          else if (error.data === 100) errorMessage = 'Video not found'
          else if (error.data === 101 || error.data === 150) errorMessage = 'Video embedding disabled'
          setPlayerError(errorMessage)
        }
      }
    })
  }, [ytReady, onPlayerReady, onPlayStateChange])

  // Handle video loading
  useEffect(() => {
    if (!playerInstanceRef.current || !videoId) return

    const loadVideo = () => {
      try {
        playerInstanceRef.current.loadVideoById(videoId)
        setPlayerError(null)
      } catch (error) {
        setPlayerError('Failed to load video')
      }
    }

    loadVideo()
  }, [videoId])

  // Handle play/pause
  useEffect(() => {
    if (!playerInstanceRef.current) return

    try {
      if (isPlaying) {
        playerInstanceRef.current.playVideo()
      } else {
        playerInstanceRef.current.pauseVideo()
      }
    } catch (error) {
      console.error('Player control error:', error)
    }
  }, [isPlaying])

  // Handle seek
  useEffect(() => {
    if (!playerInstanceRef.current || !syncTimestamp) return

    const now = Date.now()
    const latencyMs = now - syncTimestamp
    const latencySeconds = latencyMs / 1000
    const adjustedTime = Math.max(0, syncTime + latencySeconds)

    try {
      playerInstanceRef.current.seekTo(adjustedTime, true)
    } catch (error) {
      console.error('Seek error:', error)
    }
  }, [syncTime, syncTimestamp])

  // Real-time control listeners
  useEffect(() => {
    if (!socket || !roomId) return

    const handleIncomingPlayStateChange = (data) => {
      console.log('📥 Received real-time playStateChange:', data)
      try {
        if (data.isPlaying !== undefined && playerInstanceRef.current) {
          if (data.isPlaying) {
            playerInstanceRef.current.playVideo()
          } else {
            playerInstanceRef.current.pauseVideo()
          }
        }
        if (data.time !== undefined && playerInstanceRef.current) {
          playerInstanceRef.current.seekTo(data.time, true)
        }
      } catch (error) {
        console.error('Error applying real-time playStateChange:', error)
      }
    }

    const handleIncomingVolumeChange = (data) => {
      console.log('📥 Received real-time volumeChange:', data)
      try {
        if (data.volume !== undefined && playerInstanceRef.current) {
          playerInstanceRef.current.setVolume(data.volume)
          setVolume(data.volume)
        }
        if (data.muted !== undefined) {
          setMuted(data.muted)
          if (playerInstanceRef.current) {
            if (data.muted) {
              playerInstanceRef.current.mute()
            } else {
              playerInstanceRef.current.unMute()
            }
          }
        }
      } catch (error) {
        console.error('Error applying real-time volumeChange:', error)
      }
    }

    socket.on('syncPlay', handleIncomingPlayStateChange)
    socket.on('volumeChange', handleIncomingVolumeChange)

    return () => {
      socket.off('syncPlay', handleIncomingPlayStateChange)
      socket.off('volumeChange', handleIncomingVolumeChange)
    }
  }, [socket, roomId])

  // Update time and duration
  useEffect(() => {
    if (!playerInstanceRef.current) return

    const updateInfo = () => {
      try {
        const time = playerInstanceRef.current.getCurrentTime()
        const dur = playerInstanceRef.current.getDuration()

        if (time !== undefined) {
          setCurrentTime(time)
          onTimeUpdate(time)
        }
        if (dur && dur > 0) {
          setDuration(dur)
          onDurationUpdate?.(dur)
        }
      } catch (error) {
        // Ignore errors during updates
      }
    }

    const interval = setInterval(updateInfo, 100)
    return () => clearInterval(interval)
  }, [onTimeUpdate, onDurationUpdate])

  const format = (s) => {
    if (!isFinite(s) || s <= 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleSeek = (direction) => {
    if (!playerInstanceRef.current) return

    const current = playerInstanceRef.current.getCurrentTime()
    const newTime = direction === 'forward' ? current + 10 : Math.max(0, current - 10)

    try {
      playerInstanceRef.current.seekTo(newTime, true)
      onSeek?.(newTime)
      // Broadcast real-time seek
      broadcastSeek(newTime)
    } catch (error) {
      console.error('Seek error:', error)
    }
  }

  const handleVolumeChange = (newVolume) => {
    if (!playerInstanceRef.current) return

    setVolume(newVolume)
    try {
      playerInstanceRef.current.setVolume(newVolume)
      const willBeMuted = newVolume === 0
      if (newVolume > 0 && muted) {
        playerInstanceRef.current.unMute()
        setMuted(false)
      }
      // Broadcast real-time volume change
      broadcastVolumeChange(newVolume, willBeMuted)
    } catch (error) {
      console.error('Volume error:', error)
    }
  }

  const toggleMute = () => {
    if (!playerInstanceRef.current) return

    try {
      if (muted) {
        playerInstanceRef.current.unMute()
        setMuted(false)
        // Broadcast real-time unmute
        broadcastVolumeChange(volume, false)
      } else {
        playerInstanceRef.current.mute()
        setMuted(true)
        // Broadcast real-time mute
        broadcastVolumeChange(volume, true)
      }
    } catch (error) {
      console.error('Mute toggle error:', error)
    }
  }

  // Real-time control broadcasting functions
  const broadcastPlayStateChange = (playing, currentTime) => {
    if (socket && roomId) {
      console.log(`📡 Broadcasting playStateChange: playing=${playing}, time=${currentTime}`)
      socket.emit('playStateChange', {
        videoId,
        isPlaying: playing,
        time: currentTime,
        duration,
      })
    }
  }

  const broadcastSeek = (time) => {
    if (socket && roomId) {
      console.log(`📡 Broadcasting seek: time=${time}`)
      socket.emit('playStateChange', {
        videoId,
        isPlaying,
        time,
        duration,
      })
    }
  }

  const broadcastVolumeChange = (newVolume, isMuted) => {
    if (socket && roomId) {
      console.log(`📡 Broadcasting volume change: volume=${newVolume}, muted=${isMuted}`)
      socket.emit('volumeChange', {
        volume: newVolume,
        muted: isMuted,
      })
    }
  }

  const searchYouTube = async () => {
    const q = searchQuery.trim()
    if (!q) return

    const isValidId = /^[a-zA-Z0-9_-]{11}$/.test(q)
    if (isValidId) {
      onVideoChange(q)
      setSearchQuery('')
      return
    }

    setSearching(true)
    setSearchResults([])

    try {
      const KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || ''
      if (!KEY) {
        setPlayerError('YouTube API key not configured')
        return
      }

      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${KEY}`

      const response = await fetch(url, { headers: { Accept: 'application/json' } })

      if (!response.ok) {
        if (response.status === 403) setPlayerError('YouTube API quota exceeded or key invalid')
        else if (response.status === 429) setPlayerError('Too many requests')
        else setPlayerError(`Search failed (HTTP ${response.status})`)
        return
      }

      const data = await response.json()

      if (!data.items || data.items.length === 0) {
        setPlayerError('No videos found')
        return
      }

      setSearchResults(data.items)
    } catch (error) {
      setPlayerError('Search failed due to network error')
    } finally {
      setSearching(false)
    }
  }

  const selectResult = (item) => {
    const id = item?.id?.videoId
    if (!id) return

    setNowTitle(item.snippet.title)
    setNowChannel(item.snippet.channelTitle)
    setNowThumb(item.snippet.thumbnails?.high?.url)

    onVideoChange(id)
    setSearchResults([])
    setSearchQuery('')
  }

  const thumb = nowThumb || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null)

  return (
    <div className={styles.container}>
      <div className={styles.nowPlayingCard}>
        <div className={styles.artwork}>
          {thumb ? (
            <div
              className={styles.artImg}
              style={{ backgroundImage: `url(${thumb})` }}
            />
          ) : (
            <div className={styles.artPlaceholder}>🎵</div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.title}>{nowTitle || 'No track selected'}</div>
          <div className={styles.channel}>{nowChannel || 'Search YouTube Music'}</div>

          <div className={styles.controlsRow}>
            <button
              disabled={!ytReady}
              className={styles.playPauseBtn}
              onClick={() => {
                const newPlayingState = !isPlaying
                onPlayStateChange(newPlayingState)
                // Broadcast real-time play/pause
                const currentTime = playerInstanceRef.current?.getCurrentTime() || 0
                broadcastPlayStateChange(newPlayingState, currentTime)
              }}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <div className={styles.seekGroup}>
              <button
                disabled={!ytReady}
                onClick={() => handleSeek('backward')}
              >
                -10s
              </button>
              <button
                disabled={!ytReady}
                onClick={() => handleSeek('forward')}
              >
                +10s
              </button>
            </div>

            <div className={styles.timeText}>
              {format(currentTime)} / {format(syncDuration || duration)}
            </div>
          </div>

          <div className={styles.volumeRow}>
            <button
              disabled={!ytReady}
              onClick={toggleMute}
            >
              {muted ? '🔇' : '🔊'}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              disabled={!ytReady}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
            />
            <span>{volume}%</span>
          </div>
        </div>
      </div>

      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="Search YouTube Music…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
        />
        <button className={styles.searchBtn} onClick={searchYouTube}>
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className={styles.results}>
          {searchResults.map((item) => (
            <div
              key={item.id.videoId}
              className={styles.resultItem}
              onClick={() => selectResult(item)}
            >
              <div
                className={styles.resultThumb}
                style={{ backgroundImage: `url(${item.snippet.thumbnails?.medium?.url})` }}
              />
              <div>
                <div className={styles.resultTitle}>{item.snippet.title}</div>
                <div className={styles.resultChannel}>{item.snippet.channelTitle}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.playerArea}>
        <div ref={containerRef} className={styles.iframeHolder} />

        {playerError && (
          <div className={styles.playerError}>
            ⚠ {playerError}
            <div className={styles.errorActions}>
              <button onClick={() => setPlayerError(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}