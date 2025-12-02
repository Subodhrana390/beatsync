'use client'

import { useState, useEffect } from 'react'
import styles from './ConnectionGuide.module.css'

export default function ConnectionGuide({ onServerUrlChange }) {
  const [showGuide, setShowGuide] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [localIp, setLocalIp] = useState(null)

  const getLocalIP = async () => {
    try {
      // Try to get local IP using WebRTC
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      return new Promise((resolve) => {
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

  const testConnection = async () => {
    if (!serverUrl.trim()) {
      alert('Please enter a server URL first')
      return
    }

    const url = serverUrl.trim()
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/api/rooms`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        alert('✅ Connection successful! Click "Connect to Server" to use this URL.')
      } else {
        alert(`❌ Server responded with status: ${response.status}`)
      }
    } catch (error) {
      alert(`❌ Connection failed: ${error.message}`)
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

            <div className={styles.connectionOptions}>
              <h4>📶 Alternative: Use Mobile Hotspot</h4>
              <div className={styles.hotspotGuide}>
                <p><strong>If Wi-Fi isn't available, use a mobile hotspot:</strong></p>
                <ol>
                  <li>One mobile device creates a hotspot (see setup below)</li>
                  <li>Server computer connects to this hotspot</li>
                  <li>Other mobile devices connect to the same hotspot</li>
                  <li>Use the hotspot's IP address for connection</li>
                </ol>
              </div>
            </div>
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
              <div className={styles.buttonGroup}>
                <button onClick={testConnection} className={styles.testButton}>
                  Test Connection
                </button>
                <button onClick={handleServerUrlSubmit} className={styles.connectButton}>
                  Connect to Server
                </button>
              </div>
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
              <li><strong>Same network/hotspot:</strong> All devices must connect to same Wi-Fi network OR same mobile hotspot</li>
              <li><strong>Mobile hotspot issues?</strong> Restart hotspot, check password, ensure all devices connect to hotspot Wi-Fi</li>
              <li><strong>Hotspot IP:</strong> Use IP shown when connected to hotspot (usually 192.168.43.x or 172.20.10.x)</li>
              <li><strong>Firewall?</strong> Temporarily disable firewall or allow port 3001</li>
              <li><strong>Connection drops?</strong> Hotspot connections may be less stable - refresh and reconnect if needed</li>
            </ul>
          </div>

          <div className={styles.hotspotSection}>
            <h3>📶 Mobile Hotspot Alternative</h3>
            <p><strong>When Wi-Fi isn't available, use a mobile hotspot:</strong></p>

            <div className={styles.hotspotGuide}>
              <div className={styles.hotspotMethod}>
                <h4>🔥 How to Create Mobile Hotspot:</h4>

                <div className={styles.platformInstructions}>
                  <div className={styles.platform}>
                    <h5>🍎 iOS (iPhone/iPad)</h5>
                    <ol>
                      <li>Settings → Personal Hotspot</li>
                      <li>Turn ON "Allow Others to Join"</li>
                      <li>Note the Wi-Fi password shown</li>
                      <li>Hotspot Wi-Fi network is created</li>
                    </ol>
                  </div>

                  <div className={styles.platform}>
                    <h5>🤖 Android</h5>
                    <ol>
                      <li>Settings → Connections → Mobile Hotspot and Tethering</li>
                      <li>Tap Mobile Hotspot</li>
                      <li>Configure name and password</li>
                      <li>Turn ON the hotspot</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className={styles.hotspotMethod}>
                <h4>🔗 How to Connect Devices:</h4>
                <ol>
                  <li><strong>Server computer:</strong> Connect to the hotspot Wi-Fi network</li>
                  <li><strong>Other devices:</strong> Connect to the same hotspot Wi-Fi network</li>
                  <li><strong>Find IP:</strong> Check the IP assigned by hotspot (run ipconfig/ifconfig)</li>
                  <li><strong>Use hotspot IP:</strong> Usually starts with 192.168.43.x or 172.20.10.x</li>
                </ol>
              </div>

              <div className={styles.hotspotTips}>
                <h4>💡 Hotspot Tips:</h4>
                <ul>
                  <li>📶 Stay close to hotspot device for best signal</li>
                  <li>🔋 Hotspot drains battery faster - keep device charged</li>
                  <li>👥 Most hotspots support 5-10 connected devices</li>
                  <li>🌐 Monitor mobile data usage if not unlimited</li>
                  <li>🔄 If connection drops, all devices need to reconnect</li>
                  <li>🎵 Perfect for music sync, even with slower speeds!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
