'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import styles from './SyncController.module.css'

interface SyncControllerProps {
  isConnected: boolean
  videoId: string | null
  isPlaying: boolean
  syncTime: number
  serverUrl?: string
  onPlayStateChange?: (playing: boolean) => void
  onVideoChange?: (videoId: string) => void
  onTimeUpdate?: (time: number) => void
}

export default function SyncController({
  isConnected,
  videoId,
  isPlaying,
  syncTime,
  serverUrl,
  onPlayStateChange,
  onVideoChange,
  onTimeUpdate,
}: SyncControllerProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectedClients, setConnectedClients] = useState(0)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Get server URL from prop, localStorage, or default
    const url = serverUrl || 
                (typeof window !== 'undefined' && localStorage.getItem('syncServerUrl')) ||
                process.env.NEXT_PUBLIC_SOCKET_URL || 
                'http://localhost:3001'

    // Close existing socket if any
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }

    // Initialize Socket.io connection with mobile-friendly settings
    const newSocket = io(url, {
      transports: ['polling', 'websocket'], // Try polling first for mobile
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 20000,
      forceNew: false,
      upgrade: true,
    })

    newSocket.on('connect', () => {
      console.log('Connected to sync server')
      setIsSyncing(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from sync server')
      setIsSyncing(false)
    })

    newSocket.on('clientCount', (count: number) => {
      setConnectedClients(count)
    })

    newSocket.on('syncState', (state: any) => {
      // Receive initial sync state when connecting
      if (state.videoId && onVideoChange) {
        onVideoChange(state.videoId)
      }
      if (state.isPlaying !== undefined && onPlayStateChange) {
        onPlayStateChange(state.isPlaying)
      }
      if (state.currentTime !== undefined && onTimeUpdate) {
        onTimeUpdate(state.currentTime)
      }
    })

    newSocket.on('syncAll', (data: { videoId: string; isPlaying: boolean; currentTime: number }) => {
      // Handle sync all command from server
      console.log('Sync all received:', data)
      if (data.videoId && onVideoChange) {
        onVideoChange(data.videoId)
      }
      if (data.isPlaying !== undefined && onPlayStateChange) {
        onPlayStateChange(data.isPlaying)
      }
      if (data.currentTime !== undefined && onTimeUpdate) {
        onTimeUpdate(data.currentTime)
      }
    })

    newSocket.on('syncPlay', (data: { videoId: string; time: number; isPlaying: boolean }) => {
      // Handle sync play command from server
      console.log('Sync play received:', data)
      if (data.videoId && onVideoChange) {
        onVideoChange(data.videoId)
      }
      if (data.isPlaying !== undefined && onPlayStateChange) {
        onPlayStateChange(data.isPlaying)
      }
      if (data.time !== undefined && onTimeUpdate) {
        onTimeUpdate(data.time)
      }
    })

    newSocket.on('syncStop', () => {
      // Handle sync stop command from server
      console.log('Sync stopped')
      if (onPlayStateChange) {
        onPlayStateChange(false)
      }
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.close()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl])

  useEffect(() => {
    if (socket && isSyncing && videoId) {
      // Broadcast play state changes
      socket.emit('playStateChange', {
        videoId,
        isPlaying,
        time: syncTime,
      })
    }
  }, [socket, isSyncing, videoId, isPlaying, syncTime])

  const startSync = () => {
    if (socket && videoId) {
      socket.emit('startSync', {
        videoId,
        time: syncTime,
        isPlaying,
      })
    }
  }

  const stopSync = () => {
    if (socket) {
      socket.emit('stopSync')
    }
  }

  const syncAll = () => {
    if (socket && videoId) {
      socket.emit('syncAll', {
        videoId,
        time: syncTime,
        isPlaying,
      })
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <div className={styles.statusRow}>
          <span>Sync Status:</span>
          <span className={isSyncing ? styles.syncing : styles.notSyncing}>
            {isSyncing ? '🟢 Syncing' : '🔴 Not Syncing'}
          </span>
        </div>
        {connectedClients > 0 && (
          <div className={styles.clientCount}>
            {connectedClients} device(s) connected
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          className={styles.button}
          onClick={startSync}
          disabled={!videoId || !isSyncing}
        >
          Start Sync
        </button>
        <button
          className={styles.button}
          onClick={syncAll}
          disabled={!videoId || !isSyncing}
        >
          Sync All Devices
        </button>
        <button
          className={styles.button}
          onClick={stopSync}
          disabled={!isSyncing}
        >
          Stop Sync
        </button>
      </div>

      {!isSyncing && (
        <div className={styles.warning}>
          ⚠️ Sync server not connected. Make sure the sync server is running on port 3001.
        </div>
      )}

      <div className={styles.info}>
        <p>💡 Sync ensures all connected devices play audio in perfect synchronization.</p>
        <p>📡 Uses WebSocket for real-time communication between devices.</p>
        <p>🔊 Works with any audio output - Bluetooth speakers, built-in speakers, or headphones.</p>
      </div>
    </div>
  )
}

