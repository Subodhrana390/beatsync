/**
 * Audio routing utilities for directing audio output to Bluetooth speakers
 */

// Extend HTMLAudioElement and HTMLVideoElement to include setSinkId
if (typeof globalThis !== 'undefined') {
  // For Node.js-like environments, but this is mainly for browser
}

/**
 * Check if setSinkId is supported
 */
export function isAudioRoutingSupported() {
  // Check if it's a mobile device first
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )

  if (isMobile) {
    // Mobile devices don't support setSinkId
    return false
  }

  if (typeof HTMLAudioElement !== 'undefined') {
    return 'setSinkId' in HTMLAudioElement.prototype
  }
  if (typeof HTMLVideoElement !== 'undefined') {
    return 'setSinkId' in HTMLVideoElement.prototype
  }
  return false
}

/**
 * Check if device is mobile
 */
export function isMobileDevice() {
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Check if device is iOS
 */
export function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Check if device is Android
 */
export function isAndroid() {
  return /Android/i.test(navigator.userAgent)
}

/**
 * Get available audio output devices
 */
export async function getAudioOutputDevices() {
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
export function routeAudioToDevice(deviceId) {
  if (!isAudioRoutingSupported()) {
    console.warn('Audio routing not supported in this browser')
    return
  }

  // Route all audio/video elements
  document.querySelectorAll('audio, video').forEach((element) => {
    if (element instanceof HTMLAudioElement || element instanceof HTMLVideoElement) {
      try {
        element.setSinkId(deviceId)
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
function routeYouTubeAudio(deviceId) {
  // Find YouTube iframe
  const iframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]')

  iframes.forEach((iframe) => {
    try {
      // Try to access iframe content (may fail due to CORS)
      const iframeWindow = iframe.contentWindow
      if (iframeWindow) {
        const iframeDoc = iframe.contentDocument || iframeWindow.document
        const audioElements = iframeDoc?.querySelectorAll('audio, video')

        audioElements?.forEach((element) => {
          if (element instanceof HTMLAudioElement || element instanceof HTMLVideoElement) {
            try {
              element.setSinkId(deviceId)
            } catch {
              // Expected to fail due to cross-origin restrictions
            }
          }
        })
      }
    } catch {
      // Expected: Cross-origin iframe access is restricted
      // The audio will use the system's default output device
      console.log('Cannot access YouTube iframe (expected due to CORS)')
    }
  })
}

/**
 * Monitor and route new audio elements automatically
 */
export function setupAudioRoutingMonitor(deviceId) {
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
