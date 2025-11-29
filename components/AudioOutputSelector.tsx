'use client'

import { useState, useEffect, useCallback } from 'react'
import { isAudioRoutingSupported, getAudioOutputDevices, routeAudioToDevice, setupAudioRoutingMonitor, AudioDevice } from '@/lib/audioRouting'
import styles from './AudioOutputSelector.module.css'

interface AudioOutputSelectorProps {
  onDeviceChange?: (deviceId: string) => void
}

export default function AudioOutputSelector({ onDeviceChange }: AudioOutputSelectorProps) {
  const [availableDevices, setAvailableDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('default')
  const [isSupported, setIsSupported] = useState(false)

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
    const supported = isAudioRoutingSupported()
    setIsSupported(supported)

    if (supported) {
      enumerateAudioDevices()
    }
  }, [enumerateAudioDevices])

  useEffect(() => {
    if (isSupported && selectedDevice && selectedDevice !== 'default') {
      const cleanup = setupAudioRoutingMonitor(selectedDevice)
      return cleanup
    }
  }, [isSupported, selectedDevice])

  const handleDeviceChange = (deviceId: string) => {
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
        {isSupported && selectedDevice && selectedDevice !== 'default' && (
          <span className={styles.active}>✓ Active</span>
        )}
        {!isSupported && (
          <span className={styles.warning}>⚠️ Audio routing not fully supported</span>
        )}
      </div>
      
      {isSupported ? (
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
        <p>💡 Select any audio output device (Bluetooth speaker, built-in speakers, headphones, etc.)</p>
        <p>🔊 The selected device will be used for all audio playback</p>
        <p>📱 <strong>No Bluetooth connection required</strong> - works with any available audio output</p>
        {selectedDevice && selectedDevice !== 'default' && (
          <p className={styles.success}>✅ Audio is now routing to: {availableDevices.find(d => d.deviceId === selectedDevice)?.label || 'Selected device'}</p>
        )}
      </div>
    </div>
  )
}

