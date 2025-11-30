/**
 * Mobile utility functions
 */

/**
 * Check if device is mobile
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false

  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * Check if device is iOS
 */
export function isIOS() {
  if (typeof window === 'undefined') return false

  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Check if device is Android
 */
export function isAndroid() {
  if (typeof window === 'undefined') return false

  return /Android/i.test(navigator.userAgent)
}

/**
 * Get viewport dimensions
 */
export function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Check if device is in portrait mode
 */
export function isPortrait() {
  const { width, height } = getViewportSize()
  return height > width
}
