'use client'

import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import styles from './SyncController.module.css'

interface SyncState {
  videoId: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  isSyncing: boolean
}

interface ReadyState {
  readyCount: number
  totalCount: number
  allReady: boolean
}

interface SyncControllerProps {
  isConnected: boolean
  videoId: string | null
  isPlaying: boolean
  syncTime: number
  syncTimestamp?: number
  duration: number
  roomId?: string | null
  socket?: Socket | null
  onPlayStateChange?: (playing: boolean) => void
  onVideoChange?: (videoId: string) => void
  onTimeUpdate?: (time: number) => void
  onSyncTimestamp?: (timestamp: number) => void
  onDurationUpdate?: (duration: number) => void
  playerReady?: boolean
}

export default function SyncController({
  videoId,
  isPlaying,
  syncTime,
  syncTimestamp,
  duration,
  roomId,
  socket: externalSocket,
  onPlayStateChange,
  onVideoChange,
  onTimeUpdate,
  onSyncTimestamp,
  onDurationUpdate,
  playerReady = false,
}: SyncControllerProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectedClients, setConnectedClients] = useState(0)
  const [readyState, setReadyState] = useState<ReadyState>({ readyCount: 0, totalCount: 0, allReady: false })
  const [isClientReady, setIsClientReady] = useState(false)

  // Use refs to avoid dependency issues
  const socketRef = useRef<Socket | null>(null)
  const callbacksRef = useRef({ onPlayStateChange, onVideoChange, onTimeUpdate, onSyncTimestamp, onDurationUpdate })

  // Update refs when props change
  useEffect(() => {
    callbacksRef.current = { onPlayStateChange, onVideoChange, onTimeUpdate, onSyncTimestamp, onDurationUpdate }
  }, [onPlayStateChange, onVideoChange, onTimeUpdate, onSyncTimestamp, onDurationUpdate])

  useEffect(() => {
    socketRef.current = externalSocket
    console.log('🔗 SyncController: Socket prop updated:', !!externalSocket, externalSocket?.connected)
  }, [externalSocket])

  useEffect(() => {
    console.log('🔄 SyncController: Main useEffect triggered, socket available:', !!socketRef.current, 'isSyncing:', isSyncing)

    if (!socketRef.current) {
      console.log('ℹ️ SyncController: No socket available (expected when not connected)')
      setIsSyncing(false)
      setConnectedClients(0)
      return
    }

    console.log('✅ SyncController: Socket available, setting up listeners')

    const socket = socketRef.current

    // Reset sync state when room changes
    setIsSyncing(false)
    setConnectedClients(0)

    const handleConnect = () => {
      console.log('✅ SyncController: Connected to sync server')
      // Don't automatically set isSyncing to true - wait for user to start sync
    }

    const handleDisconnect = () => {
      console.log('❌ SyncController: Disconnected from sync server')
      setIsSyncing(false)
      setConnectedClients(0)
    }

    const handleClientCount = (count: number) => {
      console.log('👥 SyncController: Client count updated:', count)
      setConnectedClients(count)
    }

    const handleSyncState = (state: SyncState) => {
      console.log('📡 SyncController: Received sync state:', state)
      if (state.videoId && callbacksRef.current.onVideoChange) {
        callbacksRef.current.onVideoChange(state.videoId)
      }
      if (state.isPlaying !== undefined && callbacksRef.current.onPlayStateChange) {
        callbacksRef.current.onPlayStateChange(state.isPlaying)
      }
      if (state.currentTime !== undefined && callbacksRef.current.onTimeUpdate) {
        callbacksRef.current.onTimeUpdate(state.currentTime)
      }
      // Update sync status based on server state
      setIsSyncing(state.isSyncing)
    }

    const handleSyncAll = (data: SyncState & { timestamp?: number }) => {
      console.log('🔄 SyncController: Sync all received:', data, 'isSyncing:', data.isSyncing)
      if (data.videoId && callbacksRef.current.onVideoChange) {
        callbacksRef.current.onVideoChange(data.videoId)
      }
      if (data.isPlaying !== undefined && callbacksRef.current.onPlayStateChange) {
        callbacksRef.current.onPlayStateChange(data.isPlaying)
      }
      if (data.currentTime !== undefined && callbacksRef.current.onTimeUpdate) {
        callbacksRef.current.onTimeUpdate(data.currentTime)
      }
      if (data.timestamp !== undefined && callbacksRef.current.onSyncTimestamp) {
        callbacksRef.current.onSyncTimestamp(data.timestamp)
      }
      if (data.duration !== undefined && callbacksRef.current.onDurationUpdate) {
        callbacksRef.current.onDurationUpdate(data.duration)
      }
      // Update sync status
      console.log('🔄 SyncController: Setting isSyncing to:', data.isSyncing)
      setIsSyncing(data.isSyncing)
    }

    const handleSyncPlay = (data: { videoId: string; time: number; duration?: number; isPlaying: boolean }) => {
      console.log(`📥 SyncController: Received syncPlay: time=${data.time}s, playing=${data.isPlaying}`)
      if (data.videoId && callbacksRef.current.onVideoChange) {
        console.log(`🎬 SyncController: Updating video to ${data.videoId}`)
        callbacksRef.current.onVideoChange(data.videoId)
      }
      if (data.isPlaying !== undefined && callbacksRef.current.onPlayStateChange) {
        console.log(`▶️ SyncController: Updating play state to ${data.isPlaying}`)
        callbacksRef.current.onPlayStateChange(data.isPlaying)
      }
      if (data.time !== undefined && callbacksRef.current.onTimeUpdate) {
        console.log(`⏱️ SyncController: Updating time to ${data.time}s`)
        callbacksRef.current.onTimeUpdate(data.time)
      }
      if (data.duration !== undefined && callbacksRef.current.onDurationUpdate) {
        console.log(`📏 SyncController: Updating duration to ${data.duration}s`)
        callbacksRef.current.onDurationUpdate(data.duration)
      }
    }

    const handleSyncStop = () => {
      console.log('⏹️ SyncController: Sync stopped')
      setIsSyncing(false)
      if (callbacksRef.current.onPlayStateChange) {
        callbacksRef.current.onPlayStateChange(false)
      }
    }

    const handleReadyStateUpdate = (state: ReadyState) => {
      console.log('✅ SyncController: Ready state update:', state)
      setReadyState(state)
    }

    const handlePrepareSync = (data: { videoId: string; time: number; duration: number }) => {
      console.log('🎯 SyncController: Prepare sync received:', data)
      if (callbacksRef.current.onVideoChange) {
        callbacksRef.current.onVideoChange(data.videoId)
      }
      if (callbacksRef.current.onTimeUpdate) {
        callbacksRef.current.onTimeUpdate(data.time)
      }
      if (callbacksRef.current.onDurationUpdate) {
        callbacksRef.current.onDurationUpdate(data.duration)
      }
      // Reset ready state when preparing for new sync
      setIsClientReady(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('clientCount', handleClientCount)
    socket.on('syncState', handleSyncState)
    socket.on('syncAll', handleSyncAll)
    socket.on('syncPlay', handleSyncPlay)
    socket.on('syncStop', handleSyncStop)
    socket.on('readyStateUpdate', handleReadyStateUpdate)
    socket.on('prepareSync', handlePrepareSync)

    console.log('🎧 SyncController: Event listeners attached')

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('clientCount', handleClientCount)
      socket.off('syncState', handleSyncState)
      socket.off('syncAll', handleSyncAll)
      socket.off('syncPlay', handleSyncPlay)
      socket.off('syncStop', handleSyncStop)
      socket.off('readyStateUpdate', handleReadyStateUpdate)
      socket.off('prepareSync', handlePrepareSync)
    }
  }, []) // Empty dependency array - only run once on mount

  // Auto-report ready state when player becomes ready
  useEffect(() => {
    if (socketRef.current && roomId && playerReady && !isClientReady) {
      console.log('✅ SyncController: Reporting client as ready')
      socketRef.current.emit('clientReady')
      setIsClientReady(true)
    } else if (socketRef.current && roomId && !playerReady && isClientReady) {
      console.log('⏸️ SyncController: Reporting client as not ready')
      socketRef.current.emit('clientNotReady')
      setIsClientReady(false)
    }
  }, [playerReady, isClientReady, roomId])

  useEffect(() => {
    // Broadcast play state changes when in a room (for seek synchronization)
    if (socketRef.current && roomId) {
      console.log(`📡 SyncController: Broadcasting playStateChange - time: ${syncTime}s, playing: ${isPlaying}, room: ${roomId}`)
      socketRef.current.emit('playStateChange', {
        videoId,
        isPlaying,
        time: syncTime,
        duration,
      })
      console.log(`📤 SyncController: playStateChange emitted to server`)
    } else {
      console.log(`🚫 SyncController: Not broadcasting - socket: ${!!socketRef.current}, roomId: ${roomId}`)
    }
  }, [roomId, videoId, isPlaying, syncTime, duration]) // Broadcast whenever roomId exists

  const startSync = () => {
    if (socketRef.current && videoId && roomId) {
      console.log('▶️ SyncController: Starting sync for room:', roomId, 'video:', videoId)
      // Optimistically update UI immediately for better UX
      setIsSyncing(true)
      socketRef.current.emit('startSync', {
        videoId,
        time: syncTime,
        isPlaying: true,
      })
      console.log('📤 SyncController: Emitted startSync, UI updated optimistically')
      // Also update local play state
      if (callbacksRef.current.onPlayStateChange) {
        callbacksRef.current.onPlayStateChange(true)
      }
    } else {
      console.warn('❌ SyncController: Cannot start sync - missing requirements:', {
        socket: !!socketRef.current,
        videoId,
        roomId
      })
    }
  }

  const stopSync = () => {
    if (socketRef.current && roomId) {
      console.log('⏹️ SyncController: Stopping sync for room:', roomId)
      socketRef.current.emit('stopSync')
      setIsSyncing(false)
    }
  }

  const syncAll = () => {
    if (socketRef.current && videoId && roomId) {
      console.log('🔄 SyncController: Syncing all devices in room:', roomId)
      // Use timestamp-based sync to account for network latency
      const syncTimestamp = Date.now()
      // Optimistically update UI immediately for better UX
      setIsSyncing(true)
      socketRef.current.emit('syncAll', {
        videoId,
        time: syncTime,
        duration,
        isPlaying: true,
        timestamp: syncTimestamp, // Add timestamp for latency compensation
      })
      console.log('📤 SyncController: Emitted syncAll with timestamp, UI updated optimistically')
      // Also update local play state
      if (callbacksRef.current.onPlayStateChange) {
        callbacksRef.current.onPlayStateChange(true)
      }
    }
  }

  const syncWhenReady = () => {
    if (socketRef.current && videoId && roomId) {
      console.log('🔄 SyncController: Syncing when all devices are ready in room:', roomId)
      const syncTimestamp = Date.now()
      socketRef.current.emit('syncWhenReady', {
        videoId,
        time: syncTime,
        duration,
        timestamp: syncTimestamp,
      })
      console.log('📤 SyncController: Emitted syncWhenReady')
      // Don't update local state yet - wait for server to confirm all are ready
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
        {connectedClients > 1 && (
          <div className={styles.readyState}>
            <span>Ready Status:</span>
            <span className={readyState.allReady ? styles.allReady : styles.waiting}>
              {readyState.readyCount}/{readyState.totalCount} ready
              {readyState.allReady ? ' ✅' : ' ⏳'}
            </span>
          </div>
        )}
        {process.env.NODE_ENV === 'development' && (
          <div className={styles.debugInfo}>
            Socket: {socketRef.current ? '✅' : '❌'} |
            Room: {roomId || 'None'} |
            Video: {videoId || 'None'}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          className={styles.button}
          onClick={startSync}
          disabled={!socketRef.current || !videoId || !roomId}
        >
          Start Sync
        </button>
        <button
          className={styles.button}
          onClick={syncAll}
          disabled={!socketRef.current || !videoId || !roomId}
        >
          Sync All Devices
        </button>
        {connectedClients > 1 && (
          <button
            className={`${styles.button} ${readyState.allReady ? styles.readyButton : styles.waitingButton}`}
            onClick={syncWhenReady}
            disabled={!socketRef.current || !videoId || !roomId}
          >
            {readyState.allReady ? '🎵 Play Together' : '⏳ Wait for All Ready'}
          </button>
        )}
        <button
          className={styles.button}
          onClick={stopSync}
          disabled={!socketRef.current || !roomId || !isSyncing}
        >
          Stop Sync
        </button>
      </div>

      {(!socketRef.current || !roomId) && (
        <div className={styles.warning}>
          {!roomId
            ? '⚠️ Join or create a room first to enable sync controls.'
            : '⚠️ Not connected to sync server. Make sure you\'re connected to a room.'
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

