'use client'

import { useState, useEffect, useCallback } from 'react'
import { isAudioRoutingSupported, isMobileDevice, isIOS, isAndroid, getAudioOutputDevices, routeAudioToDevice, setupAudioRoutingMonitor } from '@/lib/audioRouting'
import styles from './AudioOutputSelector.module.css'

export default function AudioOutputSelector({ onDeviceChange }) {
  const [availableDevices, setAvailableDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOS, setMobileOS] = useState('')

  const enumerateAudioDevices = useCallback(async () => {
    try {
      const devices = await getAudioOutputDevices()
      setAvailableDevices(devices)

      // Set default device
      if (devices.length > 0 && selectedDevice === 'default') {
        const defaultDevice = devices.find(d => d.deviceId === 'default') || devices[0]
        setSelectedDevice(defaultDevice.deviceId)
        if (onDeviceChange) {
          onDeviceChange(defaultDevice.deviceId)
        }
      }
    } catch (error) {
      console.error('Error enumerating audio devices:', error)
    }
  }, [selectedDevice, onDeviceChange])

  useEffect(() => {
    const mobile = isMobileDevice()
    const ios = isIOS()
    const android = isAndroid()
    const supported = isAudioRoutingSupported()

    setIsMobile(mobile)
    setIsSupported(supported)

    if (ios) setMobileOS('iOS')
    else if (android) setMobileOS('Android')
    else if (mobile) setMobileOS('Mobile')

    if (supported && !mobile) {
      enumerateAudioDevices()
    }
  }, [enumerateAudioDevices])

  useEffect(() => {
    if (isSupported && !isMobile && selectedDevice && selectedDevice !== 'default') {
      const cleanup = setupAudioRoutingMonitor(selectedDevice)
      return cleanup
    }
  }, [isSupported, isMobile, selectedDevice])

  const handleDeviceChange = (deviceId) => {
    setSelectedDevice(deviceId)
    routeAudioToDevice(deviceId)
    if (onDeviceChange) {
      onDeviceChange(deviceId)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Audio Output</h3>
        {isSupported && !isMobile && selectedDevice && selectedDevice !== 'default' && (
          <span className={styles.active}>✓ Active</span>
        )}
        {!isSupported && (
          <span className={styles.warning}>
            {isMobile ? '📱 Mobile Device' : '⚠️ Audio routing not supported'}
          </span>
        )}
      </div>

      {isMobile ? (
        <div className={styles.mobileFallback}>
          <div className={styles.mobileIcon}>
            {mobileOS === 'iOS' ? '📱' : mobileOS === 'Android' ? '🤖' : '📱'}
          </div>
          <h4>Mobile Audio Output</h4>
          <p>On mobile devices, audio output is controlled by your device's system settings.</p>

          <div className={styles.mobileInstructions}>
            <h5>How to connect Bluetooth speakers on {mobileOS}:</h5>
            {mobileOS === 'iOS' ? (
              <ol>
                <li>Open <strong>Settings</strong> app</li>
                <li>Tap <strong>Bluetooth</strong></li>
                <li>Turn on Bluetooth if not already on</li>
                <li>Put your Bluetooth speaker in pairing mode</li>
                <li>Tap your speaker's name to connect</li>
                <li>Go to <strong>Settings → Sound & Haptics</strong></li>
                <li>Select your Bluetooth speaker as output</li>
              </ol>
            ) : mobileOS === 'Android' ? (
              <ol>
                <li>Swipe down from top of screen (twice for full quick settings)</li>
                <li>Tap the gear icon ⚙️ to open Settings</li>
                <li>Tap <strong>Connected devices</strong> or <strong>Bluetooth & device connection</strong></li>
                <li>Turn on Bluetooth if not already on</li>
                <li>Put your Bluetooth speaker in pairing mode</li>
                <li>Tap <strong>Pair new device</strong></li>
                <li>Tap your speaker's name to connect</li>
                <li>Audio will automatically route to connected Bluetooth device</li>
              </ol>
            ) : (
              <ol>
                <li>Open your device's Settings</li>
                <li>Find Bluetooth settings</li>
                <li>Turn on Bluetooth</li>
                <li>Put your Bluetooth speaker in pairing mode</li>
                <li>Connect to your speaker</li>
                <li>The system will handle audio routing automatically</li>
              </ol>
            )}
          </div>

          <div className={styles.mobileNote}>
            <p>💡 <strong>Tip:</strong> Once connected via Bluetooth, your phone/tablet will automatically play audio through the Bluetooth speaker.</p>
            <p>🔄 <strong>Note:</strong> You may need to disconnect and reconnect Bluetooth devices occasionally for best performance.</p>
          </div>
        </div>
      ) : isSupported ? (
        <div className={styles.selector}>
          <select
            value={selectedDevice}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className={styles.select}
          >
            {availableDevices.length === 0 ? (
              <option value="default">Loading devices...</option>
            ) : (
              availableDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))
            )}
          </select>
          <button onClick={enumerateAudioDevices} className={styles.refreshButton}>
            🔄 Refresh
          </button>
        </div>
      ) : (
        <div className={styles.fallback}>
          <p>Please select your Bluetooth speaker as the audio output device in your system settings.</p>
          <p className={styles.hint}>
            On Windows: Right-click speaker icon → Open Sound settings → Choose output device
            <br />
            On Mac: System Preferences → Sound → Output → Select Bluetooth speaker
            <br />
            On Mobile: Settings → Bluetooth → Select connected speaker
          </p>
        </div>
      )}

      <div className={styles.info}>
        {isMobile ? (
          <>
            <p>🎵 <strong>Mobile Sync:</strong> Audio plays through your device's connected Bluetooth speaker automatically.</p>
            <p>📱 <strong>Web Limitation:</strong> Mobile browsers don't allow programmatic audio device selection for security reasons.</p>
            <p>🔗 <strong>System Control:</strong> Use your device's Bluetooth settings to connect speakers - the app will sync perfectly!</p>
          </>
        ) : (
          <>
            <p>💡 Select any audio output device (Bluetooth speaker, built-in speakers, headphones, etc.)</p>
            <p>🔊 The selected device will be used for all audio playback</p>
            <p>📱 <strong>No Bluetooth connection required</strong> - works with any available audio output</p>
            {selectedDevice && selectedDevice !== 'default' && (
              <p className={styles.success}>✅ Audio is now routing to: {availableDevices.find(d => d.deviceId === selectedDevice)?.label || 'Selected device'}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
