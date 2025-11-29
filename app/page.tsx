'use client'

import { useState, useEffect } from 'react'
import BluetoothManager from '@/components/BluetoothManager'
import YouTubePlayer from '@/components/YouTubePlayer'
import DeviceList from '@/components/DeviceList'
import SyncController from '@/components/SyncController'
import AudioOutputSelector from '@/components/AudioOutputSelector'
import ConnectionGuide from '@/components/ConnectionGuide'
import styles from './page.module.css'

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectedDevices, setConnectedDevices] = useState<string[]>([])
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [syncTime, setSyncTime] = useState(0)
  const [serverUrl, setServerUrl] = useState<string>('')

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
            <h2 className={styles.sectionTitle}>Sync Control</h2>
            <ConnectionGuide onServerUrlChange={setServerUrl} />
            <SyncController
              isConnected={isConnected}
              videoId={currentVideoId}
              isPlaying={isPlaying}
              syncTime={syncTime}
              serverUrl={serverUrl}
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

