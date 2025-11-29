'use client'

import { useState, useEffect } from 'react'
import styles from './ConnectionGuide.module.css'

interface ConnectionGuideProps {
  onServerUrlChange?: (url: string) => void
}

export default function ConnectionGuide({ onServerUrlChange }: ConnectionGuideProps) {
  const [showGuide, setShowGuide] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [localIp, setLocalIp] = useState<string | null>(null)

  const getLocalIP = async () => {
    try {
      // Try to get local IP using WebRTC
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      return new Promise<string>((resolve) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate
            const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/)
            if (match) {
              pc.close()
              resolve(match[1])
            }
          }
        }
        setTimeout(() => {
          pc.close()
          resolve('Unable to detect')
        }, 1000)
      })
    } catch {
      return 'Unable to detect'
    }
  }

  const handleShowGuide = async () => {
    setShowGuide(true)
    if (!localIp) {
      const ip = await getLocalIP()
      setLocalIp(ip)
    }
  }

  const handleServerUrlSubmit = () => {
    if (serverUrl.trim()) {
      const url = serverUrl.trim()
      if (onServerUrlChange) {
        onServerUrlChange(url)
      }
      localStorage.setItem('syncServerUrl', url)
      alert(`Server URL set to: ${url}\nThe page will reconnect automatically.`)
    } else {
      alert('Please enter a valid server URL')
    }
  }

  useEffect(() => {
    // Load saved server URL on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('syncServerUrl')
      if (saved) {
        setServerUrl(saved)
        if (onServerUrlChange) {
          onServerUrlChange(saved)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.container}>
      <button onClick={handleShowGuide} className={styles.toggleButton}>
        {showGuide ? '▼' : '▶'} How to Connect with Other Users
      </button>

      {showGuide && (
        <div className={styles.guide}>
          <div className={styles.step}>
            <h3>Step 1: Start the Sync Server</h3>
            <p>One person needs to run the sync server on their computer:</p>
            <div className={styles.codeBlock}>
              <code>npm run server</code>
            </div>
            <p className={styles.note}>
              The server will run on <strong>port 3001</strong>
            </p>
          </div>

          <div className={styles.step}>
            <h3>Step 2: Find the Server IP Address</h3>
            <p>On the computer running the server, find its IP address:</p>
            <div className={styles.codeBlock}>
              <p><strong>Windows:</strong> Open Command Prompt and run: <code>ipconfig</code></p>
              <p><strong>Mac/Linux:</strong> Open Terminal and run: <code>ifconfig</code> or <code>ip addr</code></p>
              <p>Look for IPv4 address (usually starts with 192.168.x.x or 10.x.x.x)</p>
            </div>
            {localIp && (
              <div className={styles.ipDisplay}>
                <p>Your detected IP: <strong>{localIp}</strong></p>
                <p className={styles.hint}>If this looks correct, use: <code>http://{localIp}:3001</code></p>
              </div>
            )}
          </div>

          <div className={styles.step}>
            <h3>Step 3: Connect Other Devices</h3>
            <p>On each device that wants to join:</p>
            <ol>
              <li>Enter the server IP address below</li>
              <li>Click &quot;Connect to Server&quot;</li>
              <li>Wait for &quot;&#128994; Syncing&quot; status</li>
            </ol>
            <div className={styles.serverInput}>
              <input
                type="text"
                placeholder="http://192.168.1.100:3001"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className={styles.input}
              />
              <button onClick={handleServerUrlSubmit} className={styles.connectButton}>
                Connect to Server
              </button>
            </div>
            <p className={styles.note}>
              &#128161; For local network: Use the server&apos;s local IP (e.g., <code>http://192.168.1.100:3001</code>)
              <br />
              &#128161; For remote connection: Use the server&apos;s public IP or domain name
            </p>
          </div>

          <div className={styles.step}>
            <h3>Step 4: Start Syncing</h3>
            <p>Once all devices are connected:</p>
            <ol>
              <li>One person searches and selects a YouTube video</li>
              <li>Click &quot;Start Sync&quot; or &quot;Sync All Devices&quot;</li>
              <li>All connected devices will play in perfect sync!</li>
            </ol>
          </div>

          <div className={styles.troubleshooting}>
            <h3>&#128295; Troubleshooting</h3>
            <ul>
              <li><strong>Can&apos;t connect?</strong> Make sure the server is running and firewall allows port 3001</li>
              <li><strong>Not syncing?</strong> Check that all devices show &quot;&#128994; Syncing&quot; status</li>
              <li><strong>Same network?</strong> All devices should be on the same Wi-Fi network for local connections</li>
              <li><strong>Firewall?</strong> Temporarily disable firewall or allow port 3001</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

