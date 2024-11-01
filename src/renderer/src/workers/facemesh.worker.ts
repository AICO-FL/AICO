import * as tf from '@tensorflow/tfjs'
import '@mediapipe/face_mesh'
import '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgpu'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import * as tfjsWasm from '@tensorflow/tfjs-backend-wasm'

tfjsWasm.setWasmPaths(
  `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${tfjsWasm.version_wasm}/dist/`
)

type WorkerMessage =
  | {
      type: 'init'
      canvas: OffscreenCanvas
    }
  | {
      type: 'detect'
      frame: ImageBitmap
    }
  | {
      type: 'cleanup'
    }

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

class FaceMeshWorker {
  private detector: faceLandmarksDetection.FaceLandmarksDetector | null = null
  private isInitialized = false
  private offscreenCanvas: OffscreenCanvas | null = null
  private ctx: OffscreenCanvasRenderingContext2D | null = null
  private tempCanvas: OffscreenCanvas | null = null
  private tempCtx: OffscreenCanvasRenderingContext2D | null = null

  async initialize(canvas: OffscreenCanvas) {
    if (this.isInitialized) return

    this.offscreenCanvas = canvas
    this.ctx = this.offscreenCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: true
    }) as OffscreenCanvasRenderingContext2D

    // 一時的なキャンバスを初期化時に作成
    const scale = 3
    this.tempCanvas = new OffscreenCanvas(
      this.offscreenCanvas.width / scale,
      this.offscreenCanvas.height / scale
    )
    this.tempCtx = this.tempCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true
    }) as OffscreenCanvasRenderingContext2D

    try {
      await tf.ready()
      await tf.setBackend('webgpu')

      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
      const detectorConfig = {
        runtime: 'tfjs' as const,
        refineLandmarks: false,
        maxFaces: 1,
        scoreThreshold: 0.75
      }

      this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig)

      this.isInitialized = true
      self.postMessage({ type: 'initialized' } as WorkerResponse)
    } catch (error) {
      console.error('Worker初期化エラー:', error)
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : '不明なエラーが発生しました'
      } as WorkerResponse)
    }
  }

  async detectAndDraw(frame: ImageBitmap) {
    if (!this.detector || !this.ctx || !this.offscreenCanvas || !this.tempCtx || !this.tempCanvas)
      return

    try {
      const startTime = performance.now()
      const scale = 3

      // 縮小して描画
      this.tempCtx.drawImage(frame, 0, 0, this.tempCanvas.width, this.tempCanvas.height)

      const imageData = this.tempCtx.getImageData(
        0,
        0,
        this.tempCanvas.width,
        this.tempCanvas.height
      )

      // 顔検出
      const faces = await this.detector.estimateFaces(imageData, {
        flipHorizontal: false,
        staticImageMode: false
      })

      // メインキャンバスをクリア
      this.ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height)

      // 元の映像を描画
      this.ctx.drawImage(frame, 0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height)

      // 検出結果を描画
      if (faces[0]?.keypoints) {
        this.ctx.fillStyle = 'red'
        faces[0].keypoints.forEach((point: any) => {
          const x = point.x * scale
          const y = point.y * scale
          this.ctx!.fillRect(x, y, 3, 3)
        })
      }

      const inferenceTime = performance.now() - startTime // 計測終了

      // 推論時間を描画
      this.ctx.font = '100px Arial' // フォントサイズを100pxから24pxに縮小
      this.ctx.fillStyle = 'white'
      this.ctx.strokeStyle = 'black'
      this.ctx.lineWidth = 1 // 線の太さも調整
      const text = `${inferenceTime.toFixed(1)} ms`
      const padding = 50 // 画面端からの余白
      this.ctx.strokeText(
        text,
        this.offscreenCanvas.width - this.ctx.measureText(text).width - padding,
        70
      )
      this.ctx.fillText(
        text,
        this.offscreenCanvas.width - this.ctx.measureText(text).width - padding,
        70
      )

      // 推論時間を含めて処理完了を通知
      self.postMessage({
        type: 'frameProcessed',
        inferenceTime
      } as WorkerResponse)
    } catch (error) {
      console.error('検出エラー:', error)
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : '検出中にエラーが発生しました'
      } as WorkerResponse)
    } finally {
      frame.close()
    }
  }

  cleanup() {
    this.detector = null
    this.ctx = null
    this.tempCtx = null
    this.offscreenCanvas = null
    this.tempCanvas = null
    this.isInitialized = false
  }
}

const worker = new FaceMeshWorker()

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data

  try {
    switch (type) {
      case 'init':
        await worker.initialize(event.data.canvas)
        break
      case 'detect':
        await worker.detectAndDraw(event.data.frame)
        break
      case 'cleanup':
        worker.cleanup()
        break
    }
  } catch (error) {
    console.error('Workerエラー:', error)
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Workerでエラーが発生しました'
    } as WorkerResponse)
  }
}
