/**
 * Audio routing utilities for directing audio output to Bluetooth speakers
 */

export interface AudioDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

/**
 * Check if setSinkId is supported
 */
export function isAudioRoutingSupported(): boolean {
  if (typeof HTMLAudioElement !== 'undefined') {
    return 'setSinkId' in HTMLAudioElement.prototype
  }
  if (typeof HTMLVideoElement !== 'undefined') {
    return 'setSinkId' in HTMLVideoElement.prototype
  }
  return false
}

/**
 * Get available audio output devices
 */
export async function getAudioOutputDevices(): Promise<AudioDevice[]> {
  try {
    // Request permission first
    await navigator.mediaDevices.getUserMedia({ audio: true })
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(device => device.kind === 'audiooutput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Audio Output ${device.deviceId.substring(0, 8)}`,
        kind: device.kind,
      }))
  } catch (error) {
    console.error('Error getting audio devices:', error)
    return []
  }
}

/**
 * Route audio to a specific device
 */
export function routeAudioToDevice(deviceId: string): void {
  if (!isAudioRoutingSupported()) {
    console.warn('Audio routing not supported in this browser')
    return
  }

  // Route all audio/video elements
  document.querySelectorAll('audio, video').forEach((element) => {
    if (element instanceof HTMLAudioElement || element instanceof HTMLVideoElement) {
      try {
        (element as any).setSinkId(deviceId)
        console.log(`Audio routed to device: ${deviceId}`)
      } catch (error) {
        console.error('Error setting sink ID:', error)
      }
    }
  })

  // Try to route YouTube iframe audio
  routeYouTubeAudio(deviceId)
}

/**
 * Attempt to route YouTube iframe audio
 * Note: This is limited by browser security, but we try to apply it
 */
function routeYouTubeAudio(deviceId: string): void {
  // Find YouTube iframe
  const iframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]')
  
  iframes.forEach((iframe) => {
    try {
      // Try to access iframe content (may fail due to CORS)
      const iframeWindow = (iframe as HTMLIFrameElement).contentWindow
      if (iframeWindow) {
        const iframeDoc = (iframe as HTMLIFrameElement).contentDocument || iframeWindow.document
        const audioElements = iframeDoc?.querySelectorAll('audio, video')
        
        audioElements?.forEach((element) => {
          if (element instanceof HTMLAudioElement || element instanceof HTMLVideoElement) {
            try {
              (element as any).setSinkId(deviceId)
            } catch (error) {
              // Expected to fail due to cross-origin restrictions
            }
          }
        })
      }
    } catch (error) {
      // Expected: Cross-origin iframe access is restricted
      // The audio will use the system's default output device
      console.log('Cannot access YouTube iframe (expected due to CORS)')
    }
  })
}

/**
 * Monitor and route new audio elements automatically
 */
export function setupAudioRoutingMonitor(deviceId: string): () => void {
  if (!isAudioRoutingSupported()) {
    return () => {}
  }

  const observer = new MutationObserver(() => {
    routeAudioToDevice(deviceId)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Initial routing
  routeAudioToDevice(deviceId)

  return () => observer.disconnect()
}

