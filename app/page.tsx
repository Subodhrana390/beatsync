'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
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
  const [connectedDevices, setConnectedDevices] = useState<string[]>([])
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [syncTime, setSyncTime] = useState(0)
  const [serverUrl, setServerUrl] = useState<string>('')
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [roomSocket, setRoomSocket] = useState<Socket | null>(null)

  // Create socket connection when server URL is available
  useEffect(() => {
    if (!serverUrl) return

    // Close existing socket
    if (roomSocket) {
      roomSocket.close()
    }

    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 20000,
      forceNew: false,
      upgrade: true,
    })

    socket.on('connect', () => {
      console.log('Connected to room server')
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from room server')
      setCurrentRoomId(null)
    })

    setRoomSocket(socket)

    return () => {
      socket.close()
    }
  }, [serverUrl, roomSocket])

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
              onVideoChange={setCurrentVideoId}
              onPlayStateChange={setIsPlaying}
              onTimeUpdate={setSyncTime}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Server Connection</h2>
            <ConnectionGuide onServerUrlChange={setServerUrl} />
          </section>

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

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sync Control</h2>
            <SyncController
              isConnected={isConnected}
              videoId={currentVideoId}
              isPlaying={isPlaying}
              syncTime={syncTime}
              roomId={currentRoomId}
              socket={roomSocket}
              onPlayStateChange={setIsPlaying}
              onVideoChange={setCurrentVideoId}
              onTimeUpdate={setSyncTime}
            />
          </section>
        </div>
      </div>
    </main>
  )
}

