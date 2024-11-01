import { LipSyncAnalyzeResult } from './lipSyncAnalyzeResult'

const TIME_DOMAIN_DATA_LENGTH = 2048

export class LipSync {
  public readonly audio: AudioContext
  public readonly analyser: AnalyserNode
  public readonly timeDomainData: Float32Array

  public constructor(audio: AudioContext) {
    this.audio = audio

    this.analyser = audio.createAnalyser()
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH)
  }

  public update(): LipSyncAnalyzeResult {
    this.analyser.getFloatTimeDomainData(this.timeDomainData)

    let volume = 0.0
    for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
      volume = Math.max(volume, Math.abs(this.timeDomainData[i]))
    }

    // cook
    volume = 1 / (1 + Math.exp(-45 * volume + 5))
    if (volume < 0.1) volume = 0

    return {
      volume
    }
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    try {
      const audioBuffer = await this.audio.decodeAudioData(buffer)
      console.log('Audio successfully decoded:', audioBuffer)

      const bufferSource = this.audio.createBufferSource()
      bufferSource.buffer = audioBuffer

      bufferSource.connect(this.audio.destination)
      bufferSource.connect(this.analyser)
      bufferSource.start()
      if (onEnded) {
        bufferSource.addEventListener('ended', onEnded)
      }
    } catch (error) {
      console.error('オーディオデータのデコードに失敗しました:', error)
      // エラーハンドリングを行う（例：ユーザーに通知する、代替の再生方法を試すなど）
    }
  }

  public async playFromStream(stream: ReadableStream<Uint8Array>, onEnded?: () => void) {
    try {
      const audioContext = this.audio

      // AudioContextの状態を確認し、必要に応じて再開
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      await audioContext.audioWorklet.addModule('./audio-processor.js')
      const workletNode = new AudioWorkletNode(audioContext, 'stream-processor', {
        outputChannelCount: [1] // モノラル出力に設定
      })

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'sampleRate') {
          console.log('Received sample rate:', event.data.sampleRate)
          console.log('Received channel count:', event.data.channelCount)
          console.log('AudioContext sample rate:', audioContext.sampleRate)
        } else if (event.data.type === 'debug') {
          console.log('Audio processor debug:', event.data.message)
        } else if (event.data.type === 'done') {
          workletNode.disconnect()
          if (onEnded) onEnded()
        }
      }

      const reader = stream.getReader()
      const pump = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) {
              workletNode.port.postMessage({ type: 'end' })
              break
            }
            workletNode.port.postMessage({ type: 'data', chunk: value.buffer }, [value.buffer])
          }
        } catch (error) {
          console.error('ストリーム読み取り中にエラーが発生しました:', error)
          workletNode.port.postMessage({ type: 'end' })
        }
      }
      pump()

      workletNode.connect(audioContext.destination)
      workletNode.connect(this.analyser)

      console.log('AudioWorkletNode connected:', workletNode.numberOfOutputs > 0)
    } catch (error) {
      console.error('ストリーミング再生中にエラーが発生しました:', error)
    }
  }

  public async playFromURL(url: string, onEnded?: () => void) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const buffer = await res.arrayBuffer()
      await this.playFromArrayBuffer(buffer, onEnded)
    } catch (error) {
      console.error('URLからのオーディオ再生に失敗しました:', error)
      // エラーハンドリングを行う
    }
  }
}
