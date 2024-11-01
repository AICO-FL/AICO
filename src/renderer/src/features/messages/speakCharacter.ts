import { Language } from '../constants/settings'
import homeStore from '../stores/home'
import settingsStore from '../stores/settings'
import englishToJapanese from '../../utils/englishToJapanese.json'
import { wait } from '../../utils/wait'
import { Screenplay, Talk } from './messages'
import { synthesizeStyleBertVITS2Api } from './synthesizeStyleBertVITS2'
import { synthesizeVoiceElevenlabsApi } from './synthesizeVoiceElevenlabs'
import { synthesizeVoiceOpenAIApi } from './synthesizeVoiceOpenAI'

interface EnglishToJapanese {
  [key: string]: string
}

const typedEnglishToJapanese = englishToJapanese as EnglishToJapanese

const createSpeakCharacter = () => {
  let lastTime = 0
  let prevFetchPromise: Promise<unknown> = Promise.resolve()
  let prevSpeakPromise: Promise<unknown> = Promise.resolve()

  return (screenplay: Screenplay, onStart?: () => void, onComplete?: () => void) => {
    const ss = settingsStore.getState()
    onStart?.()

    if (ss.changeEnglishToJapanese && ss.selectLanguage === 'ja') {
      screenplay.talk.message = convertEnglishToJapaneseReading(screenplay.talk.message)
    }

    const fetchPromise = prevFetchPromise
      .catch(() => {})
      .then(async () => {
        const now = Date.now()
        if (now - lastTime < 1000) {
          await wait(1000 - (now - lastTime))
        }

        const detectedLanguage = ss.detectedLanguage
        const selectedLanguage = ss.selectLanguage

        let buffer: ArrayBuffer | null = null
        try {
          if (['japanese'].includes(detectedLanguage) || ['ja'].includes(selectedLanguage)) {
            buffer = await fetchAudioStyleBertVITS2(
              screenplay.talk,
              'http://aico.f5.si:5001',
              ss.stylebertvits2ModelId,
              ss.stylebertvits2Style,
              detectedLanguage
            )
          } else {
            buffer = await fetchAudioOpenAI(screenplay.talk, ss.openAiTtsVoice)
          }
        } catch (error) {
          console.error(`音声合成エラー: ${error}`)
          throw error // エラーを上位に伝播させる
        }

        lastTime = Date.now()
        return buffer
      })
      .catch((error) => {
        console.error('音声取得エラー:', error)
        onComplete?.() // エラー時もonCompleteを呼び出す
        return null
      })

    prevFetchPromise = fetchPromise

    // 新しい方式でのスピーク処理
    const speakPromise = Promise.all([
      fetchPromise,
      prevSpeakPromise.catch(() => undefined)
    ] as const)
      .catch(() => [null, undefined] as const)
      .then(async (results) => {
        const [buffer] = results
        if (!buffer) return

        const hs = homeStore.getState()
        try {
          await hs.viewer.model?.speak(buffer, screenplay)
        } catch (error) {
          console.error('音声再生エラー:', error)
          throw error
        }
      })
      .catch((error) => {
        console.error('スピーク処理エラー:', error)
      })
      .finally(() => {
        onComplete?.() // 成功/失敗に関わらずonCompleteを呼び出す
      })

    prevSpeakPromise = speakPromise
  }
}

function convertEnglishToJapaneseReading(text: string): string {
  const sortedKeys = Object.keys(typedEnglishToJapanese).sort((a, b) => b.length - a.length)

  return sortedKeys.reduce((result, englishWord) => {
    const japaneseReading = typedEnglishToJapanese[englishWord]
    const regex = new RegExp(`\\b${englishWord}\\b`, 'gi')
    return result.replace(regex, japaneseReading)
  }, text)
}

export const fetchAudioStyleBertVITS2 = async (
  talk: Talk,
  stylebertvits2ServerUrl: string,
  stylebertvits2ModelId: string,
  stylebertvits2Style: string,
  detectedLanguage: string
): Promise<ArrayBuffer> => {
  // 言語のマッピング
  let mappedLanguage: Language
  switch (detectedLanguage) {
    case 'japanese':
      mappedLanguage = 'ja'
      break
    default:
      mappedLanguage = 'ja'
      break
  }
  return synthesizeStyleBertVITS2Api(
    talk.message,
    stylebertvits2ServerUrl,
    stylebertvits2ModelId,
    stylebertvits2Style,
    mappedLanguage
  )
}

export const fetchAudioElevenlabs = async (
  talk: Talk,
  apiKey: string,
  voiceId: string,
  language: Language
): Promise<ArrayBuffer> => {
  const ttsVoice = await synthesizeVoiceElevenlabsApi(apiKey, talk.message, voiceId, language)
  return ttsVoice.audio.buffer
}

export const fetchAudioOpenAI = async (talk: Talk, voice: string): Promise<ArrayBuffer> => {
  const buffer = await synthesizeVoiceOpenAIApi(talk.message, voice)
  if (!buffer) {
    throw new Error('Failed to get audio buffer from OpenAI API')
  }
  return buffer
}

export const speakCharacter = createSpeakCharacter()
