'use client'

import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import styles from './RoomManager.module.css'

interface RoomManagerProps {
  socket?: Socket | null
  onRoomJoined?: (roomId: string, clientCount: number) => void
  onRoomLeft?: () => void
}

export default function RoomManager({
  socket: externalSocket,
  onRoomJoined,
  onRoomLeft,
}: RoomManagerProps) {
  const [roomId, setRoomId] = useState<string>('')
  const [inputRoomCode, setInputRoomCode] = useState<string>('')
  const [clientCount, setClientCount] = useState<number>(0)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  // Use ref to avoid dependency issues with socket object
  const socketRef = useRef<Socket | null>(null)
  const callbacksRef = useRef({ onRoomJoined, onRoomLeft })

  // Update refs when props change
  useEffect(() => {
    callbacksRef.current = { onRoomJoined, onRoomLeft }
  }, [onRoomJoined, onRoomLeft])

  useEffect(() => {
    socketRef.current = externalSocket
    console.log('🔗 RoomManager: Socket prop updated:', !!externalSocket)
  }, [externalSocket])

  useEffect(() => {
    console.log('🔄 RoomManager: Main useEffect triggered, socket exists:', !!socketRef.current)

    if (!socketRef.current) {
      console.log('❌ RoomManager: No socket provided, setting disconnected state')
      setConnectionStatus('disconnected')
      setRoomId('')
      setClientCount(0)
      if (callbacksRef.current.onRoomLeft) callbacksRef.current.onRoomLeft()
      return
    }

    const socket = socketRef.current

    // Check if socket is already connected
    if (socket.connected) {
      console.log('✅ RoomManager: Socket already connected, setting connected state')
      setConnectionStatus('connected')
    } else {
      console.log('⏳ RoomManager: Socket not connected, setting connecting state')
      setConnectionStatus('connecting')
    }

    const handleConnect = () => {
      console.log('🔗 RoomManager: Connected to room server')
      setConnectionStatus('connected')
    }

    const handleDisconnect = () => {
      console.log('🔌 RoomManager: Disconnected from room server')
      setConnectionStatus('disconnected')
      setRoomId('')
      setClientCount(0)
      if (callbacksRef.current.onRoomLeft) callbacksRef.current.onRoomLeft()
    }

    const handleConnectError = (error: any) => {
      console.error('❌ RoomManager: Connection error:', error)
      setConnectionStatus('disconnected')
    }

    const handleRoomJoined = (data: { roomId: string; clientCount: number }) => {
      setRoomId(data.roomId)
      setClientCount(data.clientCount)
      setIsCreating(false)
      setIsJoining(false)
      localStorage.setItem('currentRoomId', data.roomId)
      if (callbacksRef.current.onRoomJoined) callbacksRef.current.onRoomJoined(data.roomId, data.clientCount)
      console.log(`Joined room ${data.roomId} with ${data.clientCount} clients`)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('roomJoined', handleRoomJoined)

    // Load saved room on mount if socket is connected
    if (socket.connected) {
      setConnectionStatus('connected')
      const savedRoom = localStorage.getItem('currentRoomId')
      if (savedRoom) {
        socket.emit('joinRoom', savedRoom)
      }
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('roomJoined', handleRoomJoined)
    }
  }, []) // Empty dependency array - only run once on mount

  // Monitor socket connection state changes
  useEffect(() => {
    if (!socketRef.current) return

    const socket = socketRef.current

    const updateConnectionStatus = () => {
      if (socket.connected) {
        console.log('🔄 RoomManager: Socket connection state changed to connected')
        setConnectionStatus('connected')
      } else {
        console.log('🔄 RoomManager: Socket connection state changed to disconnected')
        setConnectionStatus('disconnected')
        setRoomId('')
        setClientCount(0)
        if (callbacksRef.current.onRoomLeft) callbacksRef.current.onRoomLeft()
      }
    }

    // Check initial state
    updateConnectionStatus()

    // Listen for connection state changes
    socket.on('connect', updateConnectionStatus)
    socket.on('disconnect', updateConnectionStatus)

    return () => {
      socket.off('connect', updateConnectionStatus)
      socket.off('disconnect', updateConnectionStatus)
    }
  }, []) // Only run once, socket ref is stable

  useEffect(() => {
    // Load saved room on mount
    if (typeof window !== 'undefined') {
      const savedRoom = localStorage.getItem('currentRoomId')
      if (savedRoom && externalSocket && connectionStatus === 'connected') {
        externalSocket.emit('joinRoom', savedRoom)
      }
    }
  }, [connectionStatus, externalSocket])

  const createRoom = () => {
    if (!socketRef.current || connectionStatus !== 'connected') return

    setIsCreating(true)
    socketRef.current.emit('createRoom')
  }

  const joinRoom = () => {
    if (!socketRef.current || connectionStatus !== 'connected' || !inputRoomCode.trim()) return

    setIsJoining(true)
    socketRef.current.emit('joinRoom', inputRoomCode.trim().toUpperCase())
  }

  const leaveRoom = () => {
    if (roomId) {
      localStorage.removeItem('currentRoomId')
      setRoomId('')
      setClientCount(0)
      setInputRoomCode('')
      if (onRoomLeft) onRoomLeft()
    }
  }

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      // Could add a toast notification here
    }
  }

  const reconnect = () => {
    if (socketRef.current) {
      console.log('🔄 Manual reconnect requested')
      socketRef.current.disconnect()
      socketRef.current.connect()
    }
  }

  const getStatusText = () => {
    if (connectionStatus === 'disconnected') return '🔴 Not Connected'
    if (connectionStatus === 'connecting') return '🟡 Connecting...'
    if (!roomId) return '🟢 Connected - No Room'
    return `🟢 Room: ${roomId} (${clientCount} users)`
  }

  const getConnectionDetails = () => {
    if (!socketRef.current) return null

    const socket = socketRef.current
    return {
      id: socket.id,
      connected: socket.connected,
      transport: socket.io?.engine?.transport?.name || 'unknown'
    }
  }

  const getStatusColor = () => {
    if (connectionStatus === 'disconnected') return styles.statusDisconnected
    if (connectionStatus === 'connecting') return styles.statusConnecting
    if (!roomId) return styles.statusNoRoom
    return styles.statusInRoom
  }

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <span className={getStatusColor()}>
          {getStatusText()}
        </span>
        {process.env.NODE_ENV === 'development' && getConnectionDetails() && (
          <div className={styles.debugInfo}>
            ID: {getConnectionDetails()?.id || 'None'} |
            Transport: {getConnectionDetails()?.transport}
          </div>
        )}
      </div>

      {connectionStatus === 'connected' ? (
        !roomId ? (
          <div className={styles.roomActions}>
            <div className={styles.actionGroup}>
              <button
                className={styles.button}
                onClick={createRoom}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : '🎯 Create New Room'}
              </button>
              <p className={styles.hint}>Create a new sync room for others to join</p>
            </div>

            <div className={styles.divider}>
              <span>OR</span>
            </div>

            <div className={styles.actionGroup}>
              <div className={styles.joinGroup}>
                <input
                  type="text"
                  placeholder="Enter room code (e.g., ABC123)"
                  value={inputRoomCode}
                  onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                  className={styles.input}
                  maxLength={6}
                />
                <button
                  className={styles.button}
                  onClick={joinRoom}
                  disabled={!inputRoomCode.trim() || isJoining}
                >
                  {isJoining ? 'Joining...' : '🚪 Join Room'}
                </button>
              </div>
              <p className={styles.hint}>Enter a room code to join an existing room</p>
            </div>
          </div>
        ) : (
          <div className={styles.roomInfo}>
            <div className={styles.roomCode}>
              <span className={styles.label}>Room Code:</span>
              <span className={styles.code}>{roomId}</span>
              <button
                className={styles.copyButton}
                onClick={copyRoomCode}
                title="Copy room code"
              >
                📋
              </button>
            </div>

            <div className={styles.roomStats}>
              <span>{clientCount} user{clientCount !== 1 ? 's' : ''} in room</span>
            </div>

            <button
              className={styles.leaveButton}
              onClick={leaveRoom}
            >
              Leave Room
            </button>
          </div>
        )
      ) : (
        <div className={styles.connectionRequired}>
          <div className={styles.connectionIcon}>
            🔗
          </div>
          <h3 className={styles.connectionTitle}>Sync Server Connection Required</h3>
          <p className={styles.connectionMessage}>
            Connect to a sync server first to create or join rooms for multi-device audio synchronization.
          </p>
          <div className={styles.connectionHint}>
            Use the "Server Connection" section above to connect to a sync server.
          </div>
          {socketRef.current && connectionStatus === 'disconnected' && (
            <button
              onClick={reconnect}
              className={styles.reconnectButton}
            >
              🔄 Try Reconnect
            </button>
          )}
        </div>
      )}
    </div>
  )
}
