'use client'

import styles from './DeviceList.module.css'

interface DeviceListProps {
  devices: string[]
}

export default function DeviceList({ devices }: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className={styles.container}>
      <div className={styles.empty}>
        <p>No Bluetooth devices connected</p>
        <p className={styles.hint}>Bluetooth connection is optional. You can use any audio output device.</p>
      </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.deviceGrid}>
        {devices.map((device, index) => (
          <div key={index} className={styles.deviceCard}>
            <div className={styles.deviceIcon}>🔊</div>
            <div className={styles.deviceName}>{device}</div>
            <div className={styles.deviceStatus}>
              <span className={styles.statusDot}></span>
              <span>Connected</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

