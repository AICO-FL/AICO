class StreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(0)
    this.isEnded = false
    this.port.onmessage = this.handleMessage.bind(this)
    this.sampleRate = 24000 // デフォルトのサンプルレート
    this.isHeaderProcessed = false
    this.channelCount = 1 // デフォルトのチャンネル数
  }

  handleMessage(event) {
    if (event.data.type === 'data') {
      const chunk = new Uint8Array(event.data.chunk)

      if (!this.isHeaderProcessed) {
        const dataOffset = this.processWAVHeader(chunk)
        if (dataOffset !== null) {
          this.isHeaderProcessed = true
          this.port.postMessage({
            type: 'sampleRate',
            sampleRate: this.sampleRate,
            channelCount: this.channelCount
          })
          const audioData = chunk.slice(dataOffset)
          const floatData = this.convertToFloat32(audioData)
          this.buffer = this.concatenateBuffers(this.buffer, floatData)
        }
      } else {
        const floatData = this.convertToFloat32(chunk)
        this.buffer = this.concatenateBuffers(this.buffer, floatData)
      }

      console.log('Current buffer size:', this.buffer.length)
    } else if (event.data.type === 'end') {
      this.isEnded = true
    }
  }

  processWAVHeader(chunk) {
    const view = new DataView(chunk.buffer)

    // WAVフォーマットチェック
    const riff = String.fromCharCode(...chunk.slice(0, 4))
    const wave = String.fromCharCode(...chunk.slice(8, 12))
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      console.error('Invalid WAV format')
      return null
    }

    // フォーマットチャンクを探す
    let offset = 12
    while (offset < chunk.length) {
      const chunkId = String.fromCharCode(...chunk.slice(offset, offset + 4))
      const chunkSize = view.getUint32(offset + 4, true)
      if (chunkId === 'fmt ') {
        const audioFormat = view.getUint16(offset + 8, true)
        this.channelCount = view.getUint16(offset + 10, true)
        this.sampleRate = view.getUint32(offset + 12, true)
        const bitsPerSample = view.getUint16(offset + 22, true)

        break
      }
      offset += 8 + chunkSize
    }

    // データチャンクを探す
    while (offset < chunk.length) {
      const chunkId = String.fromCharCode(...chunk.slice(offset, offset + 4))
      const chunkSize = view.getUint32(offset + 4, true)
      if (chunkId === 'data') {
        offset += 8
        return offset // データチャンクの開始位置を返す
      }
      offset += 8 + chunkSize
    }

    console.error('Data chunk not found')
    return null
  }

  convertToFloat32(int16Data) {
    const floatData = new Float32Array(int16Data.length / 2)
    let maxSample = 0
    for (let i = 0; i < floatData.length; i++) {
      const int16 = (int16Data[i * 2 + 1] << 8) | int16Data[i * 2]
      const signedInt16 = int16 & 0x8000 ? int16 - 0x10000 : int16
      floatData[i] = signedInt16 / 32768.0
      maxSample = Math.max(maxSample, Math.abs(floatData[i]))
    }
    return floatData
  }

  concatenateBuffers(buffer1, buffer2) {
    const result = new Float32Array(buffer1.length + buffer2.length)
    result.set(buffer1, 0)
    result.set(buffer2, buffer1.length)
    return result
  }

  process(inputs, outputs) {
    const output = outputs[0]
    if (this.buffer.length === 0) {
      if (this.isEnded) {
        this.port.postMessage({ type: 'done' })
        return false
      }
      return true
    }

    const channelCount = output.length
    const frameCount = output[0].length

    // サンプルレートの比率を計算
    const ratio = sampleRate / this.sampleRate

    const gain = 4.0 // ゲイン値を設定

    for (let channel = 0; channel < channelCount; channel++) {
      const outputChannel = output[channel]
      for (let i = 0; i < frameCount; i++) {
        const inputIndex = Math.floor(i / ratio)
        if (inputIndex < this.buffer.length) {
          outputChannel[i] = Math.min(
            this.buffer[inputIndex * this.channelCount + (channel % this.channelCount)] * gain,
            1.0
          ) // ゲインを適用しクリッピングを防ぐ
        } else {
          outputChannel[i] = 0
        }
      }
    }

    // バッファを更新
    const samplesUsed = Math.floor(frameCount / ratio) * this.channelCount
    this.buffer = this.buffer.subarray(samplesUsed)

    const maxOutput = Math.max(...output[0].map(Math.abs))

    return true
  }
}

registerProcessor('stream-processor', StreamProcessor)
