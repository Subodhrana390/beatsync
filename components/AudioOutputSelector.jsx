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
            <h5>How to select audio output on {mobileOS}:</h5>
            {mobileOS === 'iOS' ? (
              <ol>
                <li>Open <strong>Settings</strong> app</li>
                <li>Go to <strong>Sounds & Haptics</strong></li>
                <li>Select your preferred audio output device</li>
                <li>Choose from available speakers, headphones, or Bluetooth devices</li>
              </ol>
            ) : mobileOS === 'Android' ? (
              <ol>
                <li>Swipe down from the top of the screen</li>
                <li>Tap the speaker icon or expand quick settings</li>
                <li>Tap the audio output selector</li>
                <li>Choose your preferred output device from the list</li>
              </ol>
            ) : (
              <ol>
                <li>Open your device's Settings</li>
                <li>Find Sound or Audio settings</li>
                <li>Select your preferred output device</li>
                <li>Choose from available speakers or headphones</li>
              </ol>
            )}
          </div>

          <div className={styles.mobileNote}>
            <p>💡 <strong>Tip:</strong> Your mobile device will automatically use the selected audio output for all playback.</p>
            <p>🔊 <strong>Note:</strong> Make sure your preferred audio device is connected and selected in system settings.</p>
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
          <p>Please select your preferred audio output device in your system settings.</p>
          <p className={styles.hint}>
            On Windows: Right-click speaker icon → Open Sound settings → Choose output device
            <br />
            On Mac: System Preferences → Sound → Output → Select audio device
            <br />
            On Linux: Settings → Sound → Output → Choose device
          </p>
        </div>
      )}

      <div className={styles.info}>
        {isMobile ? (
          <>
            <p>🎵 <strong>Mobile Sync:</strong> Audio plays through your device's selected output automatically.</p>
            <p>📱 <strong>Web Limitation:</strong> Mobile browsers don't allow programmatic audio device selection for security reasons.</p>
            <p>🔗 <strong>System Control:</strong> Use your device's audio settings to select speakers - the app will sync perfectly!</p>
          </>
        ) : (
          <>
            <p>💡 Select any audio output device (external speakers, built-in speakers, headphones, etc.)</p>
            <p>🔊 The selected device will be used for all audio playback</p>
            <p>🎧 <strong>System Integration:</strong> Works with any audio device connected to your computer</p>
            {selectedDevice && selectedDevice !== 'default' && (
              <p className={styles.success}>✅ Audio is now routing to: {availableDevices.find(d => d.deviceId === selectedDevice)?.label || 'Selected device'}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
