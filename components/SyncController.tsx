'use client'

import { useState, useEffect } from 'react'
import { Socket } from 'socket.io-client'
import styles from './SyncController.module.css'

interface SyncState {
  videoId: string | null
  isPlaying: boolean
  currentTime: number
  isSyncing: boolean
}

interface SyncControllerProps {
  isConnected: boolean
  videoId: string | null
  isPlaying: boolean
  syncTime: number
  roomId?: string | null
  socket?: Socket | null
  onPlayStateChange?: (playing: boolean) => void
  onVideoChange?: (videoId: string) => void
  onTimeUpdate?: (time: number) => void
}

export default function SyncController({
  videoId,
  isPlaying,
  syncTime,
  roomId,
  socket: externalSocket,
  onPlayStateChange,
  onVideoChange,
  onTimeUpdate,
}: SyncControllerProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectedClients, setConnectedClients] = useState(0)

  useEffect(() => {
    if (!externalSocket) {
      setIsSyncing(false)
      setConnectedClients(0)
      return
    }

    // Reset state when room changes
    setIsSyncing(false)
    setConnectedClients(0)

    const socket = externalSocket

    socket.on('connect', () => {
      console.log('Connected to sync server')
      setIsSyncing(true)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from sync server')
      setIsSyncing(false)
      setConnectedClients(0)
    })

    socket.on('clientCount', (count: number) => {
      setConnectedClients(count)
    })

    socket.on('syncState', (state: SyncState) => {
      // Receive initial sync state when connecting to room
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

    socket.on('syncAll', (data: { videoId: string; isPlaying: boolean; currentTime: number }) => {
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

    socket.on('syncPlay', (data: { videoId: string; time: number; isPlaying: boolean }) => {
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

    socket.on('syncStop', () => {
      // Handle sync stop command from server
      console.log('Sync stopped')
      if (onPlayStateChange) {
        onPlayStateChange(false)
      }
    })

    // Cleanup function to remove listeners
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('clientCount')
      socket.off('syncState')
      socket.off('syncAll')
      socket.off('syncPlay')
      socket.off('syncStop')
    }
  }, [externalSocket, roomId, onPlayStateChange, onTimeUpdate, onVideoChange])

  useEffect(() => {
    if (externalSocket && isSyncing && videoId && roomId) {
      // Broadcast play state changes
      externalSocket.emit('playStateChange', {
        videoId,
        isPlaying,
        time: syncTime,
      })
    }
  }, [externalSocket, isSyncing, videoId, isPlaying, syncTime, roomId])

  const startSync = () => {
    if (externalSocket && videoId && roomId) {
      // Always start sync with playing=true to ensure video starts
      externalSocket.emit('startSync', {
        videoId,
        time: syncTime,
        isPlaying: true, // Force playing state for sync start
      })
      // Also update local state to start playing
      if (onPlayStateChange) {
        onPlayStateChange(true)
      }
    }
  }

  const stopSync = () => {
    if (externalSocket && roomId) {
      externalSocket.emit('stopSync')
    }
  }

  const syncAll = () => {
    if (externalSocket && videoId && roomId) {
      externalSocket.emit('syncAll', {
        videoId,
        time: syncTime,
        isPlaying: true, // Force playing state for sync all
      })
      // Also update local state to start playing
      if (onPlayStateChange) {
        onPlayStateChange(true)
      }
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
          disabled={!videoId || !roomId || !isSyncing}
        >
          Start Sync
        </button>
        <button
          className={styles.button}
          onClick={syncAll}
          disabled={!videoId || !roomId || !isSyncing}
        >
          Sync All Devices
        </button>
        <button
          className={styles.button}
          onClick={stopSync}
          disabled={!roomId || !isSyncing}
        >
          Stop Sync
        </button>
      </div>

      {(!isSyncing || !roomId) && (
        <div className={styles.warning}>
          {!roomId
            ? '⚠️ Join or create a room first to enable sync controls.'
            : '⚠️ Sync server not connected. Make sure the sync server is running and you\'re in a room.'
          }
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

