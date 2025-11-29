'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (!externalSocket) {
      setConnectionStatus('disconnected')
      setRoomId('')
      setClientCount(0)
      if (onRoomLeft) onRoomLeft()
      return
    }

    setConnectionStatus('connecting')

    const socket = externalSocket

    socket.on('connect', () => {
      console.log('Connected to room server')
      setConnectionStatus('connected')
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from room server')
      setConnectionStatus('disconnected')
      setRoomId('')
      setClientCount(0)
      if (onRoomLeft) onRoomLeft()
    })

    socket.on('roomJoined', (data: { roomId: string; clientCount: number }) => {
      setRoomId(data.roomId)
      setClientCount(data.clientCount)
      setIsCreating(false)
      setIsJoining(false)
      localStorage.setItem('currentRoomId', data.roomId)
      if (onRoomJoined) onRoomJoined(data.roomId, data.clientCount)
      console.log(`Joined room ${data.roomId} with ${data.clientCount} clients`)
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      setConnectionStatus('disconnected')
    })

    // Load saved room on mount if socket is connected
    if (socket.connected) {
      setConnectionStatus('connected')
      const savedRoom = localStorage.getItem('currentRoomId')
      if (savedRoom) {
        socket.emit('joinRoom', savedRoom)
      }
    }

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('roomJoined')
      socket.off('connect_error')
    }
  }, [externalSocket, onRoomJoined, onRoomLeft])

  useEffect(() => {
    // Load saved room on mount
    if (typeof window !== 'undefined') {
      const savedRoom = localStorage.getItem('currentRoomId')
      if (savedRoom && socket && connectionStatus === 'connected') {
        socket.emit('joinRoom', savedRoom)
      }
    }
  }, [connectionStatus])

  const createRoom = () => {
    if (!socket || connectionStatus !== 'connected') return

    setIsCreating(true)
    socket.emit('createRoom')
  }

  const joinRoom = () => {
    if (!socket || connectionStatus !== 'connected' || !inputRoomCode.trim()) return

    setIsJoining(true)
    socket.emit('joinRoom', inputRoomCode.trim().toUpperCase())
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

  const getStatusText = () => {
    if (connectionStatus === 'disconnected') return '🔴 Not Connected'
    if (connectionStatus === 'connecting') return '🟡 Connecting...'
    if (!roomId) return '🟢 Connected - No Room'
    return `🟢 Room: ${roomId} (${clientCount} users)`
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
      </div>

      {!roomId ? (
        <div className={styles.roomActions}>
          <div className={styles.actionGroup}>
            <button
              className={styles.button}
              onClick={createRoom}
              disabled={connectionStatus !== 'connected' || isCreating}
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
                disabled={connectionStatus !== 'connected' || !inputRoomCode.trim() || isJoining}
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
      )}

      {connectionStatus === 'disconnected' && (
        <div className={styles.warning}>
          ⚠️ Connect to a sync server first to create or join rooms
        </div>
      )}
    </div>
  )
}
