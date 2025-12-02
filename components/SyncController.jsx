'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './SyncController.module.css'

export default function SyncController({
  videoId,
  isPlaying,
  syncTime,
  syncTimestamp: _syncTimestamp, // eslint-disable-line @typescript-eslint/no-unused-vars
  duration,
  roomId,
  socket: externalSocket,
  onPlayStateChange,
  onVideoChange,
  onTimeUpdate,
  onSyncTimestamp,
  onDurationUpdate,
  playerReady = false,
}) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [connectedClients, setConnectedClients] = useState(0)
  const [readyState, setReadyState] = useState({
    readyCount: 0,
    totalCount: 0,
    allReady: false
  })
  const [isClientReady, setIsClientReady] = useState(false)
  const [connectedClientList, setConnectedClientList] = useState([])

  const socketRef = useRef(null)
  const callbacksRef = useRef({
    onPlayStateChange,
    onVideoChange,
    onTimeUpdate,
    onSyncTimestamp,
    onDurationUpdate
  })

  useEffect(() => {
    callbacksRef.current = {
      onPlayStateChange,
      onVideoChange,
      onTimeUpdate,
      onSyncTimestamp,
      onDurationUpdate
    }
  }, [onPlayStateChange, onVideoChange, onTimeUpdate, onSyncTimestamp, onDurationUpdate])

  useEffect(() => {
    socketRef.current = externalSocket
    console.log(
      '🔗 SyncController: Socket prop updated:',
      !!externalSocket,
      externalSocket?.connected
    )
  }, [externalSocket])

  useEffect(() => {
    console.log(
      '🔄 SyncController: Main useEffect triggered, socket available:',
      !!socketRef.current,
      'isSyncing:',
      isSyncing
    )

    if (!socketRef.current) {
      console.log('ℹ️ SyncController: No socket available')
      setIsSyncing(false)
      setConnectedClients(0)
      return
    }

    const socket = socketRef.current

    setIsSyncing(false)
    setConnectedClients(0)

    const handleConnect = () => {
      console.log('✅ SyncController: Connected to sync server')
    }

    const handleDisconnect = () => {
      console.log('❌ SyncController: Disconnected from sync server')
      setIsSyncing(false)
      setConnectedClients(0)
    }

    const handleClientCount = (count) => {
      console.log('👥 SyncController: Client count updated:', count)
      setConnectedClients(count)
    }

    const handleSyncState = (state) => {
      console.log('📡 SyncController: Received sync state:', state)
      if (state.videoId && callbacksRef.current.onVideoChange) {
        callbacksRef.current.onVideoChange(state.videoId)
      }
      if (
        state.isPlaying !== undefined &&
        callbacksRef.current.onPlayStateChange
      ) {
        callbacksRef.current.onPlayStateChange(state.isPlaying)
      }
      if (
        state.currentTime !== undefined &&
        callbacksRef.current.onTimeUpdate
      ) {
        callbacksRef.current.onTimeUpdate(state.currentTime)
      }
      setIsSyncing(state.isSyncing)
    }

    const handleSyncAll = (data) => {
      console.log(
        '🔄 SyncController: syncAll received:',
        data,
        'isSyncing:',
        data.isSyncing
      )
      if (data.videoId && callbacksRef.current.onVideoChange) {
        callbacksRef.current.onVideoChange(data.videoId)
      }
      if (
        data.isPlaying !== undefined &&
        callbacksRef.current.onPlayStateChange
      ) {
        callbacksRef.current.onPlayStateChange(data.isPlaying)
      }
      if (
        data.currentTime !== undefined &&
        callbacksRef.current.onTimeUpdate
      ) {
        callbacksRef.current.onTimeUpdate(data.currentTime)
      }
      if (
        data.timestamp !== undefined &&
        callbacksRef.current.onSyncTimestamp
      ) {
        callbacksRef.current.onSyncTimestamp(data.timestamp)
      }
      if (
        data.duration !== undefined &&
        callbacksRef.current.onDurationUpdate
      ) {
        callbacksRef.current.onDurationUpdate(data.duration)
      }

      setIsSyncing(data.isSyncing)
    }

    const handleSyncPlay = (data) => {
      console.log(
        `📥 SyncController: Received syncPlay: time=${data.time}s, playing=${data.isPlaying}`
      )
      if (data.videoId && callbacksRef.current.onVideoChange) {
        callbacksRef.current.onVideoChange(data.videoId)
      }
      if (
        data.isPlaying !== undefined &&
        callbacksRef.current.onPlayStateChange
      ) {
        callbacksRef.current.onPlayStateChange(data.isPlaying)
      }
      if (
        data.time !== undefined &&
        callbacksRef.current.onTimeUpdate
      ) {
        callbacksRef.current.onTimeUpdate(data.time)
      }
      if (
        data.duration !== undefined &&
        callbacksRef.current.onDurationUpdate
      ) {
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

    const handleReadyStateUpdate = (state) => {
      console.log('✅ SyncController: Ready state update:', state)
      setReadyState(state)
    }

    const handlePrepareSync = (data) => {
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
      setIsClientReady(false)
    }

    const handleClientListUpdate = (data) => {
      console.log('👥 SyncController: Client list update:', data)
      setConnectedClientList(data.clients)
      setConnectedClients(data.totalCount)
      setReadyState({
        readyCount: data.readyCount,
        totalCount: data.totalCount,
        allReady: data.readyCount === data.totalCount
      })
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
    socket.on('clientListUpdate', handleClientListUpdate)

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
      socket.off('clientListUpdate', handleClientListUpdate)
    }
  }, []) // run once

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

  // Heartbeat
  useEffect(() => {
    if (!socketRef.current || !roomId) return

    const heartbeatInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('heartbeat')
      }
    }, 30000)

    return () => clearInterval(heartbeatInterval)
  }, [roomId])

  // 🚫 IMPORTANT: removed the auto-broadcast useEffect that was sending
  // playStateChange on every isPlaying/syncTime change.
  // This prevents echo loops and double-seek problems.

  const startSync = () => {
    if (socketRef.current && videoId && roomId) {
      console.log(
        '▶️ SyncController: Starting sync for room:',
        roomId,
        'video:',
        videoId
      )
      setIsSyncing(true)
      socketRef.current.emit('startSync', {
        videoId,
        time: syncTime,
        isPlaying: true,
        duration,
        timestamp: Date.now()
      })
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
      const syncTimestamp = Date.now()
      setIsSyncing(true)
      socketRef.current.emit('syncAll', {
        videoId,
        time: syncTime,
        duration,
        isPlaying: true,
        timestamp: syncTimestamp,
      })
      if (callbacksRef.current.onPlayStateChange) {
        callbacksRef.current.onPlayStateChange(true)
      }
    }
  }

  const syncWhenReady = () => {
    if (socketRef.current && videoId && roomId) {
      console.log(
        '🔄 SyncController: Syncing when all devices are ready in room:',
        roomId
      )
      const syncTimestamp = Date.now()
      socketRef.current.emit('syncWhenReady', {
        videoId,
        time: syncTime,
        duration,
        timestamp: syncTimestamp,
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
        <div className={styles.statusRow}>
          <span>Connection:</span>
          <span
            className={
              socketRef.current?.connected
                ? styles.connected
                : styles.disconnected
            }
          >
            {socketRef.current?.connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
        {connectedClients > 0 && (
          <>
            <div className={styles.clientCount}>
              {connectedClients} device
              {connectedClients !== 1 ? 's' : ''} connected
            </div>
            {connectedClientList.length > 0 && (
              <div className={styles.clientList}>
                <div className={styles.clientListHeader}>
                  Connected Devices:
                </div>
                {connectedClientList.map((client) => (
                  <div key={client.id} className={styles.clientItem}>
                    <span
                      className={`${styles.clientStatus} ${
                        client.ready ? styles.ready : styles.notReady
                      }`}
                    >
                      {client.ready ? '🟢' : '🔴'}
                    </span>
                    <span className={styles.clientInfo}>
                      Device {client.id.slice(-4)}
                      <span className={styles.clientDetails}>
                        {client.userAgent.split(' ')[0]} •{' '}
                        {new Date(client.connectedAt).toLocaleTimeString()}
                      </span>
                    </span>
                    <span className={styles.connectionIndicator}>
                      {new Date() - new Date(client.lastSeen) < 60000
                        ? '🟢'
                        : '🟡'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {connectedClients > 1 && (
              <div className={styles.readyState}>
                <span>Ready Status:</span>
                <span
                  className={
                    readyState.allReady ? styles.allReady : styles.waiting
                  }
                >
                  {readyState.readyCount}/{readyState.totalCount} ready
                  {readyState.allReady ? ' ✅' : ' ⏳'}
                </span>
              </div>
            )}
          </>
        )}
        {process.env.NODE_ENV === 'development' && (
          <div className={styles.debugInfo}>
            Socket: {socketRef.current ? '✅' : '❌'} | Room: {roomId || 'None'} |{' '}
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
            className={`${styles.button} ${
              readyState.allReady ? styles.readyButton : styles.waitingButton
            }`}
            onClick={syncWhenReady}
            disabled={!socketRef.current || !videoId || !roomId}
          >
            {readyState.allReady ? '🎵 Play Together' : '⏳ Wait for All Ready'}
          </button>
        )}
        <button
          className={`${styles.button} ${styles.testButton}`}
          onClick={() => {
            console.log(
              '🧪 Manual seek sync test: setting syncTime to 30s (local only)'
            )
            if (callbacksRef.current.onTimeUpdate) {
              callbacksRef.current.onTimeUpdate(30)
            }
          }}
          disabled={!socketRef.current || !roomId}
          title="Test seek sync by jumping to 30s"
        >
          🧪 Test Seek (30s)
        </button>
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
            : "⚠️ Not connected to sync server. Make sure you're connected to a room."}
        </div>
      )}

      <div className={styles.info}>
        <p>💡 Sync ensures all connected devices play audio in perfect synchronization.</p>
        <p>📡 Uses WebSocket for real-time communication between devices.</p>
        <p>🔊 Works with any audio output - Bluetooth speakers, built-in speakers, or headphones.</p>
        <p>📶 <strong>Flexible Connections:</strong> Works on same Wi-Fi network OR same mobile hotspot.</p>
        {connectedClients > 1 && (
          <p className={styles.mobileReady}>🎵 Perfect sync across all connected devices!</p>
        )}
      </div>
    </div>
  )
}
