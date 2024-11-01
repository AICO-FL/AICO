import settingsStore from '../stores/settings'

const ss = settingsStore.getState()

interface OpenAIResponse extends Response {
  ok: boolean
  status: number
  statusText: string
  body: ReadableStream<Uint8Array> | null
}

// 音声データの振幅を増幅する関数
function amplifyAudio(buffer: ArrayBuffer, gain: number): ArrayBuffer {
  const view = new DataView(buffer)
  const amplified = buffer.slice(0) // コピーを作成
  const amplifiedView = new DataView(amplified)

  // WAVヘッダーをスキップ (44バイト)
  const headerSize = 44

  // 16ビットPCMデータとして処理
  for (let i = headerSize; i < buffer.byteLength; i += 2) {
    const sample = view.getInt16(i, true)
    // gainの値だけ振幅を増幅 (クリッピングを防ぐために制限)
    const amplifiedSample = Math.max(-32768, Math.min(32767, sample * gain))
    amplifiedView.setInt16(i, amplifiedSample, true)
  }

  return amplified
}

export async function synthesizeVoiceOpenAIApi(
  message: string,
  voice: string,
  gain: number = 10.0 // 倍の音量
): Promise<ArrayBuffer> {
  try {
    const response = await fetchOpenAISpeechApi({ message, voice })
    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`)
    }

    const audioBuffer = await response.arrayBuffer()
    // 音声データを増幅
    const amplifiedBuffer = amplifyAudio(audioBuffer, gain)
    return amplifiedBuffer
  } catch (error) {
    console.error('Error synthesizing voice:', error)
    throw error
  }
}

async function fetchOpenAISpeechApi({
  message,
  voice,
  model = 'tts-1',
  response_format = 'wav',
  speed = 1
}) {
  const apiKey = ss.openAiKey

  if (!apiKey) {
    throw new Error('OpenAI API key is not set')
  }

  if (!message) {
    throw new Error('Message is required')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: message,
        voice,
        response_format,
        speed
      })
    })

    console.log('OpenAI API Response Status:', response.status)
    console.log(
      'OpenAI API Response Headers:',
      JSON.stringify(Object.fromEntries(response.headers), null, 2)
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API error:', errorData)
      throw new Error('Error synthesizing speech')
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    // Parse WAV header and log it
    const headerBuffer = await response.clone().arrayBuffer()
    const wavHeader = parseWAVHeader(headerBuffer)
    console.log('WAV Header:', wavHeader)

    return response
  } catch (error) {
    console.error('Error synthesizing speech:', error)
    throw error
  }
}

function parseWAVHeader(buffer) {
  const view = new DataView(buffer)
  return {
    chunkId: String.fromCharCode(...new Uint8Array(buffer, 0, 4)),
    chunkSize: view.getUint32(4, true),
    format: String.fromCharCode(...new Uint8Array(buffer, 8, 4)),
    subchunk1Id: String.fromCharCode(...new Uint8Array(buffer, 12, 4)),
    subchunk1Size: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    subchunk2Id: String.fromCharCode(...new Uint8Array(buffer, 36, 4)),
    subchunk2Size: view.getUint32(40, true)
  }
}

async function streamToResponse(reader) {
  const bufferSize = 65536
  let buffer = new Uint8Array(0)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return buffer
      }

      buffer = concatUint8Arrays(buffer, value)

      if (buffer.length >= bufferSize) {
        buffer = buffer.slice(bufferSize)
      }
    }
  } catch (error) {
    console.error('Error streaming response:', error)
    throw error
  }
}

function concatUint8Arrays(a, b) {
  const result = new Uint8Array(a.length + b.length)
  result.set(a, 0)
  result.set(b, a.length)
  return result
}
