import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type WebcamStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'

type WebcamErrorName =
  | 'NotAllowedError'
  | 'PermissionDeniedError'
  | 'NotFoundError'
  | 'DevicesNotFoundError'
  | 'NotReadableError'
  | 'TrackStartError'
  | 'AbortError'
  | 'SecurityError'
  | 'OverconstrainedError'

export interface UseWebcamResult {
  stream: MediaStream | null
  status: WebcamStatus
  error: string | null
  isSupported: boolean
  start: () => Promise<boolean>
  stop: () => void
}

function isWebcamError(error: unknown): error is DOMException & { name: WebcamErrorName } {
  return error instanceof DOMException
}

function describeCameraError(error: unknown) {
  if (isWebcamError(error)) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'Camera permission was denied. Allow access in your browser settings and try again.'
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on this device. Connect a camera and try again.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'The camera is already in use by another application.'
      case 'OverconstrainedError':
        return 'The selected camera does not support the requested video settings.'
      case 'AbortError':
        return 'Camera startup was interrupted. Please try again.'
      default:
        return 'The camera could not be started. Please try again.'
    }
  }
  return 'The camera could not be started. Please check your browser and device settings.'
}

/** Owns the complete MediaStream lifecycle so React views never manage tracks directly. */
export function useWebcam(videoRef: RefObject<HTMLVideoElement | null>): UseWebcamResult {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<WebcamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSupported] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia))
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    const videoElement = videoRef.current
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (videoElement) videoElement.srcObject = null
    }
  }, [videoRef])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    if (mountedRef.current) {
      setStream(null)
      setStatus('idle')
      setError(null)
    }
  }, [videoRef])

  const start = useCallback(async () => {
    if (streamRef.current) return true
    if (!isSupported || !navigator.mediaDevices?.getUserMedia) {
      if (mountedRef.current) {
        setStatus('unavailable')
        setError('Camera access is not available in this browser. Use a modern browser over HTTPS or localhost.')
      }
      return false
    }

    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    if (!window.isSecureContext && !isLocalhost) {
      if (mountedRef.current) {
        setStatus('unavailable')
        setError('Camera access requires HTTPS. Open this app on HTTPS or localhost and try again.')
      }
      return false
    }

    if (mountedRef.current) {
      setStatus('requesting')
      setError(null)
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', height: { ideal: 720 }, width: { ideal: 1280 } },
      })
      if (!mountedRef.current) {
        nextStream.getTracks().forEach((track) => track.stop())
        return false
      }
      if (!videoRef.current) {
        nextStream.getTracks().forEach((track) => track.stop())
        setStatus('error')
        setError('The video preview could not be initialized. Please reload the page.')
        return false
      }
      streamRef.current = nextStream
      videoRef.current.srcObject = nextStream
      setStream(nextStream)
      try { await videoRef.current.play() } catch { /* muted video normally autoplays */ }
      setStatus('active')
      return true
    } catch (cameraError) {
      if (mountedRef.current) {
        const name = isWebcamError(cameraError) ? cameraError.name : ''
        setStatus(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'error')
        setError(describeCameraError(cameraError))
      }
      return false
    }
  }, [isSupported, videoRef])

  return { error, isSupported, start, status, stop, stream }
}
