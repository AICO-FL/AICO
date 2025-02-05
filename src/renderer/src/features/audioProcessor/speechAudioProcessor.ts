// WAVファイルからオーディオデータを抽出し、Float32Arrayに変換する関数
export function extractAudioDataFromWAV(arrayBuffer: ArrayBuffer): Float32Array {
  // WAVヘッダーをスキップ（通常44バイト）
  const audioData = new Int16Array(arrayBuffer.slice(44))

  // Int16ArrayをFloat32Arrayに変換
  const floatAudioData = new Float32Array(audioData.length)
  for (let i = 0; i < audioData.length; i++) {
    floatAudioData[i] = audioData[i] / 32768.0 // Int16の最大値で正規化
  }

  return floatAudioData
}

// 音量レベルをチェックする関数
function checkVolumeLevel(audioData: Float32Array): { 
  isValid: boolean; 
  maxVolume: number;
  reason?: string;
} {
  let maxVolume = 0
  for (let i = 0; i < audioData.length; i++) {
    maxVolume = Math.max(maxVolume, Math.abs(audioData[i]))
  }

  // 音量が小さすぎる場合
  if (maxVolume < 0.01) {
    return { isValid: false, maxVolume, reason: 'too_quiet' }
  }
  // 音量が大きすぎる場合
  if (maxVolume > 1.0) {
    return { isValid: false, maxVolume, reason: 'too_loud' }
  }

  return { isValid: true, maxVolume }
}

// 音量を正規化する関数
function normalizeVolume(audioData: Float32Array, targetPeak: number = 0.5): Float32Array {
  const maxVolume = Math.max(...audioData.map(Math.abs))
  if (maxVolume === 0) return audioData

  const normalizedData = new Float32Array(audioData.length)
  const scaleFactor = targetPeak / maxVolume

  for (let i = 0; i < audioData.length; i++) {
    normalizedData[i] = audioData[i] * scaleFactor
  }

  return normalizedData
}

// ゲイン調整を適用する関数
export function adjustGain(audioData: Float32Array, gain: number = 1.0): Float32Array {
  try {
    const adjustedData = audioData.map((sample) => {
      // クリッピングを防ぐため、-1.0から1.0の範囲に収める
      return Math.max(-1.0, Math.min(1.0, sample * gain))
    })
    return adjustedData
  } catch (error) {
    console.error('ゲイン調整中にエラーが発生しました:', error)
    return audioData
  }
}

// ノイズゲートを適用する関数
export function applyNoiseGate(
  audioData: Float32Array,
  threshold: number = 0.005,
  softKnee: number = 0.002
): Float32Array {
  try {
    return audioData.map((sample) => {
      const amplitude = Math.abs(sample)
      if (amplitude >= threshold + softKnee) {
        return sample
      } else if (amplitude <= threshold - softKnee) {
        return 0
      } else {
        const factor = (amplitude - (threshold - softKnee)) / (2 * softKnee)
        return sample * factor
      }
    })
  } catch (error) {
    console.error('ノイズゲート適用中にエラーが発生しました:', error)
    return audioData
  }
}

// コンプレッサーを適用する関数
export function applyCompressor(
  audioData: Float32Array,
  threshold: number = 0.1,
  ratio: number = 2,
  attackTime: number = 0.003,
  releaseTime: number = 0.25
): Float32Array {
  try {
    const sampleRate = 44100
    const attackSamples = Math.floor(attackTime * sampleRate)
    const releaseSamples = Math.floor(releaseTime * sampleRate)

    let envelope = 0
    const compressedData = new Float32Array(audioData.length)

    for (let i = 0; i < audioData.length; i++) {
      const inputLevel = Math.abs(audioData[i])

      if (inputLevel > envelope) {
        envelope += (inputLevel - envelope) / attackSamples
      } else {
        envelope += (inputLevel - envelope) / releaseSamples
      }

      let gain = 1
      if (envelope > threshold) {
        gain = threshold + (envelope - threshold) / ratio
        gain /= envelope
      }

      compressedData[i] = audioData[i] * gain
    }

    return compressedData
  } catch (error) {
    console.error('コンプレッサー適用中にエラーが発生しました:', error)
    return audioData
  }
}

// WAVエンコーダー関数
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // WAVヘッダーの書き込み
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // オーディオデータの書き込み
  floatTo16BitPCM(view, 44, samples)

  return buffer
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

// 全ての音声処理を適用し、WAVエンコードする関数
export async function processAndEncodeAudio(
  audioData: ArrayBuffer,
  sampleRate: number = 16000
): Promise<{ buffer: ArrayBuffer | null; error?: string }> {
  try {
    const floatAudioData = extractAudioDataFromWAV(audioData)

    // 音量チェック
    const volumeCheck = checkVolumeLevel(floatAudioData)
    if (!volumeCheck.isValid) {
      return {
        buffer: null,
        error: volumeCheck.reason === 'too_quiet' 
          ? 'quiet'
          : 'loud'
      }
    }

    // 音声処理のパイプライン
    let processedData = floatAudioData

    // 音量の正規化（目標ピークレベル: 0.5）
    processedData = normalizeVolume(processedData, 0.5)

    // ノイズゲートとコンプレッサーの適用
    processedData = applyNoiseGate(processedData, 0.005, 0.002)
    processedData = applyCompressor(processedData, 0.1, 2, 0.003, 0.25)

    // 最終的な音量チェック
    const finalVolumeCheck = checkVolumeLevel(processedData)
    if (!finalVolumeCheck.isValid) {
      return {
        buffer: null,
        error: finalVolumeCheck.reason === 'too_quiet' 
          ? 'quiet'
          : 'loud'
      }
    }

    // WAVエンコード
    const encodedData = encodeWAV(processedData, sampleRate)
    console.log('エンコード後のデータサイズ:', encodedData.byteLength)

    return { buffer: encodedData }
  } catch (error) {
    console.error('音声処理中にエラーが発生しました:', error)
    return { buffer: null, error: 'processing_error' }
  }
}