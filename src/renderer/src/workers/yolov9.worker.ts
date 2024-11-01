import * as Comlink from 'comlink'
import * as ort from 'onnxruntime-web/webgpu'

export interface YoloWorker {
  loadModel(modelPath: string, wasmPaths: any): Promise<boolean>
  runInference(inputTensor: Float32Array, dims: readonly number[]): Promise<Float32Array>
}

class YoloWorkerImpl implements YoloWorker {
  private session: ort.InferenceSession | null = null
  private isRunning: boolean = false

  async loadModel(modelPath: string, wasmPaths: any) {
    ort.env.wasm.wasmPaths = wasmPaths

    try {
      if (this.session) {
        await this.session.release()
        this.session = null
      }

      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgpu'],
        executionMode: 'parallel',
        graphOptimizationLevel: 'all'
      })
      return true
    } catch (err) {
      console.error('モデルのロードに失敗:', err)
      return false
    }
  }

  async runInference(inputTensor: Float32Array, dims: readonly number[]) {
    if (!this.session) {
      throw new Error('セッションが初期化されていません')
    }

    if (this.isRunning) {
      return new Float32Array(0) // 空の結果を返す
    }

    try {
      this.isRunning = true
      const tensor = new ort.Tensor('float32', inputTensor, dims)
      const feeds = { input_bgr: tensor }
      const output = await this.session.run(feeds)
      return output['batchno_classid_score_x1y1x2y2'].data as Float32Array
    } catch (err) {
      console.error('推論に失敗:', err)
      throw err
    } finally {
      this.isRunning = false
    }
  }
}

// インスタンスを作成してからexposeする
Comlink.expose(new YoloWorkerImpl())
