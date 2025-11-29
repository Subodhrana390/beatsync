'use client'

import { useState, useEffect } from 'react'
import styles from './BluetoothManager.module.css'

// Web Bluetooth API types
interface BluetoothDevice {
  id: string;
  name?: string;
  addEventListener: (event: string, handler: () => void) => void;
}

interface Bluetooth {
  requestDevice: (options: {
    filters?: Array<{ services: string[] }>;
    optionalServices?: string[];
  }) => Promise<BluetoothDevice>;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth: Bluetooth;
}

interface BluetoothManagerProps {
  onConnectionChange: (connected: boolean, devices: string[]) => void
}

export default function BluetoothManager({ onConnectionChange }: BluetoothManagerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [connectedDevices, setConnectedDevices] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if Web Bluetooth API is supported
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      setIsSupported(true)
    } else {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      if (isMobile) {
        setError('Web Bluetooth is not available on mobile browsers. Use system settings to connect Bluetooth speakers, then select them in Audio Output.')
      } else {
        setError('Web Bluetooth API is not supported in this browser. Please use Chrome or Edge.')
      }
    }
  }, [])

  const scanForDevices = async () => {
    if (!isSupported) {
      setError('Bluetooth not supported')
      return
    }

    setIsScanning(true)
    setError(null)

    try {
      // Request Bluetooth device with audio service
      const device = await (navigator as NavigatorWithBluetooth).bluetooth.requestDevice({
        filters: [
          { services: ['0000110a-0000-1000-8000-00805f9b34fb'] }, // Audio/Video Remote Control
          { services: ['0000110d-0000-1000-8000-00805f9b34fb'] }, // Advanced Audio Distribution
        ],
        optionalServices: ['battery_service', 'device_information'],
      })

      device.addEventListener('gattserverdisconnected', () => {
        setConnectedDevices((prev) => prev.filter((d) => d !== device.id))
        onConnectionChange(connectedDevices.length > 1, connectedDevices.filter((d) => d !== device.id))
      })

      const newDevices = [...connectedDevices, device.name || device.id]
      setConnectedDevices(newDevices)
      onConnectionChange(true, newDevices)
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'NotFoundError') {
        setError(error.message || 'Failed to connect to Bluetooth device')
      }
    } finally {
      setIsScanning(false)
    }
  }

  const disconnectDevice = (deviceId: string) => {
    setConnectedDevices((prev) => {
      const updated = prev.filter((d) => d !== deviceId)
      onConnectionChange(updated.length > 0, updated)
      return updated
    })
  }

  return (
    <div className={styles.container}>
      {!isSupported && (
        <div className={styles.warning}>
          &#9888; Web Bluetooth requires HTTPS or localhost. Please ensure you&apos;re using a secure connection.
        </div>
      )}

      <div className={styles.status}>
        <div className={styles.statusIndicator}>
          <span className={connectedDevices.length > 0 ? styles.connected : styles.disconnected}></span>
          {connectedDevices.length > 0 ? 'Connected' : 'Not Connected'}
        </div>
        {connectedDevices.length > 0 && (
          <span className={styles.deviceCount}>{connectedDevices.length} device(s)</span>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        className={styles.scanButton}
        onClick={scanForDevices}
        disabled={isScanning || !isSupported}
      >
        {isScanning ? 'Scanning...' : 'Scan for Bluetooth Speakers'}
      </button>

      {connectedDevices.length > 0 && (
        <div className={styles.deviceList}>
          <h3>Connected Devices:</h3>
          <ul>
            {connectedDevices.map((device, index) => (
              <li key={index} className={styles.deviceItem}>
                <span>{device}</span>
                <button
                  className={styles.disconnectButton}
                  onClick={() => disconnectDevice(device)}
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.info}>
        <p>💡 <strong>Optional:</strong> Bluetooth connection is not required. The app works with any audio output device.</p>
        <p>🔊 If you want to use Bluetooth speakers, connect them via system settings first, then select them in the Audio Output section.</p>
        <p>📱 This app works best with Chrome or Edge browsers on mobile devices.</p>
      </div>
    </div>
  )
}

