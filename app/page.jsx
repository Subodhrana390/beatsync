'use client'

import { useState, useEffect ,useCallback, useRef} from 'react'
import { io } from 'socket.io-client'
import BluetoothManager from '@/components/BluetoothManager'
import YouTubePlayer from '@/components/YouTubePlayer'
import DeviceList from '@/components/DeviceList'
import SyncController from '@/components/SyncController'
import AudioOutputSelector from '@/components/AudioOutputSelector'
import ConnectionGuide from '@/components/ConnectionGuide'
import RoomManager from '@/components/RoomManager'
import styles from './page.module.css'

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectedDevices, setConnectedDevices] = useState([])
  const [currentVideoId, setCurrentVideoId] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [syncTime, setSyncTime] = useState(0)
  const prevSyncTimeRef = useRef(0)
  const [syncTimestamp, setSyncTimestamp] = useState(undefined)
  const [duration, setDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)

  // Handle seek events from YouTubePlayer and broadcast to sync controller
  const handleSeek = useCallback((time) => {
    console.log(`🎯 Main app: handleSeek called with ${time}s`)
    setSyncTime(time)
    console.log(`📡 Main app: syncTime set to ${time}s, triggering re-render and SyncController broadcast`)
    // The SyncController will automatically broadcast this change via useEffect
  }, [])

  // Handle player ready state changes
  const handlePlayerReady = useCallback((ready) => {
    console.log('🎵 Main app: Player ready state changed:', ready)
    setPlayerReady(ready)
  }, [])

  // Track syncTime changes for debugging
  useEffect(() => {
    const prevSyncTime = prevSyncTimeRef.current
    if (syncTime !== prevSyncTime) {
      console.log(`🔄 Main app: syncTime changed from ${prevSyncTime}s to ${syncTime}s`)
      prevSyncTimeRef.current = syncTime
    }
  }, [syncTime])
  const [serverUrl, setServerUrl] = useState('')
  const [isEnvConfigured, setIsEnvConfigured] = useState(false)
  const [currentRoomId, setCurrentRoomId] = useState(null)
  const [roomSocket, setRoomSocket] = useState(null)

  // Check for environment variable and set up initial connection
  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (envUrl) {
      console.log('🔧 Environment variable detected:', envUrl)
      // Check for mixed content issues
      const isHttps = window.location.protocol === 'https:'
      const serverIsHttps = envUrl.startsWith('https:')
      if (isHttps && !serverIsHttps) {
        console.warn('⚠️ Mixed content warning: App is HTTPS but server is HTTP. This may cause connection issues.')
      }
      setServerUrl(envUrl)
      setIsEnvConfigured(true)
    } else {
      // Check for saved server URL from previous sessions
      const savedUrl = localStorage.getItem('syncServerUrl')
      if (savedUrl) {
        console.log('🔄 Found saved server URL, attempting to reconnect:', savedUrl)
        setServerUrl(savedUrl)
      }
    }
  }, [])

  // Connection test function
  const testConnection = async () => {
    if (!serverUrl) {
      alert('No server URL configured')
      return
    }

    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/rooms`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        alert('✅ Server connection successful!')
      } else {
        alert(`❌ Server responded with status: ${response.status}`)
      }
    } catch (error) {
      alert(`❌ Connection failed: ${error.message}`)
    }
  }

  // Create socket connection when server URL is available
  useEffect(() => {
    if (!serverUrl) return

    console.log('🔌 Main app: Creating socket connection to:', serverUrl)
    console.log('🔍 Connection config:', {
      url: serverUrl,
      protocol: window.location.protocol,
      isHttps: window.location.protocol === 'https:',
      serverIsHttps: serverUrl.startsWith('https:')
    })

    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      timeout: 10000,
      forceNew: false, // Don't force new connection
      upgrade: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      multiplex: false, // Don't multiplex connections
    })

    socket.on('connect', () => {
      console.log('✅ Main app: Connected to sync server:', serverUrl)
      console.log('🔍 Connection details:', {
        id: socket.id,
        transport: socket.io.engine.transport.name,
        connected: socket.connected
      })
    })

    socket.on('connecting', () => {
      console.log('🔄 Main app: Connecting to sync server...')
    })

    socket.on('connect_attempt', () => {
      console.log('🎯 Main app: Connect attempt to:', serverUrl)
    })

    socket.on('ping', () => {
      console.log('🏓 Main app: Ping sent')
    })

    socket.on('pong', () => {
      console.log('🏓 Main app: Pong received')
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Main app: Disconnected from sync server:', reason)
      console.log('🔍 Disconnect details:', {
        connected: socket.connected,
        disconnected: socket.disconnected,
        id: socket.id,
        reason: reason
      })
      setCurrentRoomId(null)
    })

    socket.on('connect_error', (error) => {
      console.error('🚨 Main app: Connection error:', error)
      console.error('🔍 Error details:', {
        message: error.message,
        type: error.type,
        description: error.description
      })
      setRoomSocket(null) // Clear the socket on connection error
    })

    // Handle development server issues
    socket.on('error', (error) => {
      console.error('🚨 Main app: Socket error:', error)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Main app: Reconnected to sync server after', attemptNumber, 'attempts')
    })

    socket.on('reconnect_error', (error) => {
      console.error('🚨 Main app: Reconnection error:', error)
      setRoomSocket(null) // Clear the socket on reconnection error
    })

    setRoomSocket(socket)

    return () => {
      socket.close()
    }
  }, [serverUrl])

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>🎵 BeatSync</h1>
          <p className={styles.subtitle}>Multi-Device Audio Sync (Bluetooth Optional)</p>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Bluetooth Connection (Optional)</h2>
            <BluetoothManager
              onConnectionChange={(connected, devices) => {
                setIsConnected(connected)
                setConnectedDevices(devices)
              }}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Connected Bluetooth Devices (Optional)</h2>
            <DeviceList devices={connectedDevices} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Audio Output</h2>
            <AudioOutputSelector />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>YouTube Music Player</h2>
            <YouTubePlayer
              videoId={currentVideoId}
              isPlaying={isPlaying}
              syncTime={syncTime}
              syncTimestamp={syncTimestamp}
              duration={duration}
              socket={roomSocket}
              roomId={currentRoomId}
              onVideoChange={setCurrentVideoId}
              onPlayStateChange={setIsPlaying}
              onTimeUpdate={setSyncTime}
              onDurationUpdate={setDuration}
              onSeek={handleSeek}
              onPlayerReady={handlePlayerReady}
            />
          </section>

          {!isEnvConfigured && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Server Connection</h2>
              <ConnectionGuide onServerUrlChange={setServerUrl} />
            </section>
          )}

          {isEnvConfigured && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Server Connection</h2>
              <div className={styles.connectionStatus}>
                <div className={styles.statusIndicator}>
                  <span className={roomSocket?.connected ? styles.connected : styles.disconnected}></span>
                  {roomSocket?.connected ? '🟢 Connected to Sync Server' :
                   roomSocket ? '🟡 Connecting to Sync Server...' :
                   '🔴 Failed to connect - check server'}
                  {roomSocket && (
                    <div className={styles.debugInfo}>
                      Socket ID: {roomSocket.id || 'None'}<br/>
                      Transport: {roomSocket.io?.engine?.transport?.name || 'Unknown'}
                    </div>
                  )}
                </div>
                <p className={styles.serverUrl}>Server: {serverUrl}</p>
                <div className={styles.connectionActions}>
                  <button
                    onClick={testConnection}
                    className={styles.testConnectionButton}
                  >
                    Test Connection
                  </button>
                  {roomSocket && !roomSocket.connected && (
                    <button
                      onClick={() => {
                        // Force reconnect by clearing and recreating socket
                        if (roomSocket) {
                          roomSocket.close()
                        }
                        setRoomSocket(null)
                        // The useEffect will recreate the socket
                        setTimeout(() => {
                          console.log('🔄 Forcing socket reconnection...')
                        }, 100)
                      }}
                      className={styles.reconnectButton}
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {roomSocket ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Room Management</h2>
              <RoomManager
                socket={roomSocket}
                onRoomJoined={(roomId, clientCount) => {
                  setCurrentRoomId(roomId)
                  console.log(`Joined room ${roomId} with ${clientCount} clients`)
                }}
                onRoomLeft={() => {
                  setCurrentRoomId(null)
                }}
              />
            </section>
          ) : (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Room Management</h2>
              <div className={styles.roomManagementPlaceholder}>
                <div className={styles.placeholderIcon}>
                  {isEnvConfigured ? '⏳' : '🏠'}
                </div>
                <h3 className={styles.placeholderTitle}>
                  {isEnvConfigured ? 'Connecting to Server...' : 'Connect to Server First'}
                </h3>
                <p className={styles.placeholderMessage}>
                  {isEnvConfigured
                    ? 'Establishing connection to the configured sync server. Room management will be available shortly.'
                    : 'Room management will be available once you connect to a sync server above.'
                  }
                </p>
                {isEnvConfigured && (
                  <div className={styles.connectionHint}>
                    Server: {serverUrl}
                  </div>
                )}
              </div>
            </section>
          )}

          {roomSocket && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Sync Control</h2>
              <SyncController
                isConnected={isConnected}
                videoId={currentVideoId}
                isPlaying={isPlaying}
                syncTime={syncTime}
                syncTimestamp={syncTimestamp}
                duration={duration}
                roomId={currentRoomId}
                socket={roomSocket}
                onPlayStateChange={setIsPlaying}
                onVideoChange={setCurrentVideoId}
                onTimeUpdate={setSyncTime}
                onSyncTimestamp={setSyncTimestamp}
                onDurationUpdate={setDuration}
                playerReady={playerReady}
              />
            </section>
          )}

          {!roomSocket && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Sync Control</h2>
              <div className={styles.roomManagementPlaceholder}>
                <div className={styles.placeholderIcon}>🔗</div>
                <h3 className={styles.placeholderTitle}>Connect to Sync Server</h3>
                <p className={styles.placeholderMessage}>
                  Sync controls will be available once you connect to a sync server above.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
