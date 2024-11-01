import { useState, useRef, useEffect } from 'react'
import '@mediapipe/face_mesh'

const width = 1920
const height = 1080

type WorkerResponse =
  | {
      type: 'initialized'
    }
  | {
      type: 'frameProcessed'
      inferenceTime: number
    }
  | {
      type: 'error'
      error: string
    }

function FaceMesh(): JSX.Element {
  const [isCameraReady, setIsCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const [isWorkerReady, setIsWorkerReady] = useState(false)
  const isProcessingRef = useRef(false)
  const frameRequestIdRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0)

  useEffect(() => {
    const initializeWorker = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      try {
        const offscreenCanvas = canvas.transferControlToOffscreen()

        workerRef.current = new Worker(
          new URL('../../workers/facemesh.worker.ts', import.meta.url),
          {
            type: 'module'
          }
        )

        workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const { type } = event.data
          switch (type) {
            case 'initialized':
              setIsWorkerReady(true)
              break
            case 'frameProcessed':
              isProcessingRef.current = false
              break
            case 'error':
              console.error('Workerエラー:', event.data.error)
              isProcessingRef.current = false
              break
          }
        }

        workerRef.current.postMessage({ type: 'init', canvas: offscreenCanvas }, [offscreenCanvas])
      } catch (error) {
        console.error(
          'Worker初期化エラー:',
          error instanceof Error ? error.message : '不明なエラーが発生しました'
        )
      }
    }

    initializeWorker()

    return () => {
      if (frameRequestIdRef.current) {
        cancelAnimationFrame(frameRequestIdRef.current)
      }
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'cleanup' })
        workerRef.current.terminate()
      }
    }
  }, [])

  useEffect(() => {
    if (workerRef.current && videoRef.current && isWorkerReady) {
      const videoElement = videoRef.current
      const minFrameInterval = 1000 / 30 // 30fps制限

      const processFrame = async () => {
        const currentTime = performance.now()

        if (
          !isProcessingRef.current &&
          videoElement.readyState === videoElement.HAVE_ENOUGH_DATA &&
          currentTime - lastFrameTimeRef.current >= minFrameInterval
        ) {
          isProcessingRef.current = true
          lastFrameTimeRef.current = currentTime

          try {
            const bitmap = await createImageBitmap(videoElement, {
              resizeQuality: 'low'
            })
            workerRef.current?.postMessage({ type: 'detect', frame: bitmap }, [bitmap])
          } catch (error) {
            console.error('フレーム処理エラー:', error)
            isProcessingRef.current = false
          }
        }
        frameRequestIdRef.current = requestAnimationFrame(processFrame)
      }

      processFrame()

      return () => {
        if (frameRequestIdRef.current) {
          cancelAnimationFrame(frameRequestIdRef.current)
          frameRequestIdRef.current = null
        }
      }
    }
  }, [isWorkerReady])

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: width,
            height: height,
            facingMode: 'user'
          }
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsCameraReady(true)
          }
        }
      } catch (error) {
        console.error('カメラの初期化エラー:', error)
      }
    }

    setupCamera()

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
        // transform: scale(0.3) を削除
      }}
    >
      <video
        ref={videoRef}
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', // 親要素に合わせて調整
          height: '100%', // 親要素に合わせて調整
          objectFit: 'cover', // アスペクト比を維持しながらカバー
          zIndex: 1
        }}
      ></video>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', // 親要素に合わせて調整
          height: '100%', // 親要素に合わせて調整
          border: 'none',
          backgroundColor: 'transparent',
          zIndex: 4
        }}
      ></canvas>
    </div>
  )
}

export default FaceMesh
