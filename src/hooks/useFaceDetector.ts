import { useEffect, useRef, useState, type RefObject } from 'react'
import type { FaceDetector } from '@mediapipe/tasks-vision'

export type FaceDetectorStatus = 'idle' | 'loading' | 'ready' | 'error'
export interface FaceBox { height: number; score: number; width: number; x: number; y: number }
interface UseFaceDetectorOptions { canvasRef: RefObject<HTMLCanvasElement | null>; isActive: boolean; videoRef: RefObject<HTMLVideoElement | null> }
export interface UseFaceDetectorResult { boxes: FaceBox[]; error: string | null; faceCount: number; lastFrameAt: number | null; status: FaceDetectorStatus }

const DETECTION_INTERVAL_MS = 250 // Four samples per second keeps CPU/GPU work bounded.
const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/models/blaze_face_short_range.tflite'

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
}

function drawFaceBoxes(canvas: HTMLCanvasElement | null, boxes: FaceBox[]) {
  if (!canvas) return
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (boxes.length === 0) return
  const lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 180))
  context.lineWidth = lineWidth
  context.strokeStyle = '#d6f36b'
  context.fillStyle = '#d6f36b'
  context.font = `600 ${Math.max(12, lineWidth * 5)}px DM Sans, sans-serif`
  boxes.forEach((box) => {
    context.strokeRect(box.x, box.y, box.width, box.height)
    context.fillText(`${Math.round(box.score * 100)}%`, box.x + lineWidth, Math.max(lineWidth * 5, box.y - lineWidth))
  })
}

/** Loads MediaPipe on demand and samples video at a fixed four frames per second. */
export function useFaceDetector({ canvasRef, isActive, videoRef }: UseFaceDetectorOptions): UseFaceDetectorResult {
  const detectorRef = useRef<FaceDetector | null>(null)
  const [boxes, setBoxes] = useState<FaceBox[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null)
  const [status, setStatus] = useState<FaceDetectorStatus>('idle')

  useEffect(() => {
    let disposed = false
    let intervalId: number | undefined
    const reset = () => { setBoxes([]); setLastFrameAt(null); clearCanvas(canvasRef.current) }
    if (!isActive) {
      setStatus('idle'); setError(null); reset()
      return () => { disposed = true; if (intervalId !== undefined) window.clearInterval(intervalId); detectorRef.current?.close(); detectorRef.current = null }
    }
    setStatus('loading'); setError(null); reset()

    const initialize = async () => {
      try {
        const { FaceDetector: MediaPipeFaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        if (disposed) return
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
        if (disposed) return
        let detector: FaceDetector
        try {
          detector = await MediaPipeFaceDetector.createFromOptions(vision, {
            baseOptions: { delegate: 'GPU', modelAssetPath: MODEL_PATH },
            minDetectionConfidence: 0.5, minSuppressionThreshold: 0.3, runningMode: 'VIDEO',
          })
        } catch {
          detector = await MediaPipeFaceDetector.createFromOptions(vision, {
            baseOptions: { delegate: 'CPU', modelAssetPath: MODEL_PATH },
            minDetectionConfidence: 0.5, minSuppressionThreshold: 0.3, runningMode: 'VIDEO',
          })
        }
        if (disposed) { detector.close(); return }
        detectorRef.current = detector
        setStatus('ready')
        let lastTimestamp = -1
        intervalId = window.setInterval(() => {
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas || !detectorRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight }
          const timestamp = performance.now()
          if (timestamp <= lastTimestamp) return
          lastTimestamp = timestamp
          try {
            const result = detectorRef.current.detectForVideo(video, timestamp)
            const nextBoxes = result.detections.flatMap((detection) => {
              const box = detection.boundingBox
              if (!box) return []
              const score = detection.categories.reduce((highest, category) => Math.max(highest, category.score), 0)
              return [{ height: box.height, score, width: box.width, x: box.originX, y: box.originY }]
            })
            setBoxes(nextBoxes); drawFaceBoxes(canvas, nextBoxes); setLastFrameAt(Date.now())
          } catch (detectionError) {
            if (!disposed) { setError(detectionError instanceof Error ? detectionError.message : 'Face detection stopped unexpectedly.'); setStatus('error'); if (intervalId !== undefined) window.clearInterval(intervalId) }
          }
        }, DETECTION_INTERVAL_MS)
      } catch (initializationError) {
        if (!disposed) { setError(initializationError instanceof Error ? initializationError.message : 'The face detector could not be loaded.'); setStatus('error') }
      }
    }
    void initialize()
    return () => { disposed = true; if (intervalId !== undefined) window.clearInterval(intervalId); detectorRef.current?.close(); detectorRef.current = null }
  }, [canvasRef, isActive, videoRef])

  return { boxes, error, faceCount: boxes.length, lastFrameAt, status }
}
