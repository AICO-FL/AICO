import { useState, useEffect, useCallback } from 'react'
import homeStore, { HomeState } from '../features/stores/home'
import { SpeechChunks } from '../features/sileoVAD/SpeechChunks'
import { bindKey } from '../utils/bindKey'
import settingsStore, { setDetectedLanguage } from '../features/stores/settings'
//import { Language } from '../features/constants/settings'
import { processAndEncodeAudio } from '../features/audioProcessor/speechAudioProcessor'
import { OpenAI } from 'openai'
import { ThinScreen } from './thinScreen'

type Props = {
  onChatProcessStart: (text: string) => void
}

export const MessageInputContainer = ({ onChatProcessStart }: Props) => {
  const chatProcessing = homeStore((s: HomeState) => s.chatProcessing)
  const [userMessage, setUserMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speechChunks, setSpeechChunks] = useState<SpeechChunks | null>(null)
  const [isButtonDisabled, setIsButtonDisabled] = useState(false)
  const [isSButtonLocked, setIsSButtonLocked] = useState(false)
  const [isLoopMode, setIsLoopMode] = useState(false)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)

  // VADと録音を開始する
  const startVadAndRecording = useCallback(async () => {
    try {
      console.log('MessageInputContainer: Starting VAD and recording...')
      if (speechChunks) {
        await speechChunks.stop()
      }
      const chunks = new SpeechChunks(
        () => {
          console.log('MessageInputContainer: Speech started')
          setIsRecording(true)
        },
        async (blob) => {
          console.log('MessageInputContainer: Speech ended')
          setIsRecording(false)
          setSpeechChunks(null)
          await processAndSendAudioToWhisper(blob)
        }
      )
      console.log('MessageInputContainer: SpeechChunks created')
      await chunks.start()
      console.log('MessageInputContainer: SpeechChunks started')
      setSpeechChunks(chunks)
      setError(null)
      console.log('MessageInputContainer: VAD and recording started successfully')
    } catch (error) {
      console.error('MessageInputContainer: Error starting VAD and recording:', error)
      setError('マイクの使用を許可してください。')
      setIsRecording(false)
      setIsLoopMode(false) // エラー時はループモードを解除
    }
  }, [])

  // VADと録音を停止する
  const stopVadAndRecording = useCallback(() => {
    if (speechChunks) {
      console.log('Stopping VAD and recording...')
      speechChunks.stop()
      setSpeechChunks(null)
      setIsRecording(false)
      console.log('VAD and recording stopped')
    }
  }, [speechChunks])

  // 音声データを処理してWhisper APIに送信する
  const processAndSendAudioToWhisper = async (audioBlob: Blob) => {
    setIsSButtonLocked(true)
    setIsWaitingForResponse(true) // 音声認識完了時にフラグを立てる

    const config = window.api.getConfig()
    const openaiApiKey = config.General.OpenAI_API_Key
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true
    })

    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      const processedAudioData = await processAndEncodeAudio(arrayBuffer, 16000)

      const processedFile = new File([processedAudioData], 'audio.wav', {
        type: 'audio/wav',
        lastModified: Date.now()
      })

      console.log('Processed file size:', processedFile.size)
      console.log('Processed file type:', processedFile.type)

      const { selectLanguage, isAutoLanguageDetection } = settingsStore.getState()
      console.log('選択された言語:', selectLanguage, '自動検出:', isAutoLanguageDetection)

      const transcriptionOptions = {
        file: processedFile,
        model: 'whisper-1',
        response_format: 'verbose_json' as const,
        ...(!isAutoLanguageDetection && isValidLanguageCode(selectLanguage)
          ? { language: selectLanguage }
          : {})
      }

      const response = await openai.audio.transcriptions.create(transcriptionOptions)

      if (!response || !response.text) {
        throw new Error('Invalid response from Whisper API')
      }

      const transcribedText = response.text
      const detectedLanguage = response.language

      if (!transcribedText || transcribedText.trim() === '') {
        setError('音声を認識できませんでした。もう一度お試しください。')
        return
      }

      setUserMessage(transcribedText)
      setDetectedLanguage(detectedLanguage)
      onChatProcessStart(transcribedText)
      console.log('Detected language:', detectedLanguage)
    } catch (error) {
      console.error('Error processing and sending audio to Whisper:', error)
      setError('音声の処理と送信中にエラーが発生しました。')
      setIsLoopMode(false) // エラー時はループモードを解除
      setIsSButtonLocked(false)
    } finally {
      setIsSButtonLocked(false)
    }
  }

  const isValidLanguageCode = (code: string): boolean => {
    const validCodes = ['ja', 'en', 'zh']
    return validCodes.includes(code)
  }

  const handleClickMicButton = useCallback(() => {
    if (isButtonDisabled || isSButtonLocked) return

    setIsButtonDisabled(true)
    setTimeout(() => setIsButtonDisabled(false), 3000)

    if (isRecording || speechChunks) {
      stopVadAndRecording()
      setIsLoopMode(false) // 録音停止時にループモードも解除
    } else {
      startVadAndRecording()
    }
  }, [
    isRecording,
    speechChunks,
    startVadAndRecording,
    stopVadAndRecording,
    isButtonDisabled,
    isSButtonLocked
  ])

  useEffect(() => {
    const handleKeyPress = (key: string) => {
      if (key.toLowerCase() === 's' && !isSButtonLocked) {
        console.log('Sキーが押されました')
        setIsLoopMode((prev) => !prev) // Sキーでループモードをトグル
        handleClickMicButton()
      }
    }

    const unbindKey = bindKey(handleKeyPress)
    return () => {
      unbindKey()
    }
  }, [handleClickMicButton, isSButtonLocked])

  useEffect(() => {
    if (!chatProcessing) {
      setUserMessage('')
    }
  }, [chatProcessing])

  useEffect(() => {
    return () => {
      if (speechChunks) {
        speechChunks.close()
      }
    }
  }, [speechChunks])

  useEffect(() => {
    const unsubscribe = homeStore.subscribe((state: HomeState) => {
      if (state.chatProcessingCount > 0) {
        setIsWaitingForResponse(false) // AI応答開始時にフラグを下ろす
      }

      if (state.chatProcessingCount === 0 && !isWaitingForResponse) {
        setIsSButtonLocked(false)

        // ループモードが有効で、応答待ちでない場合のみVADを再開
        if (isLoopMode) {
          setTimeout(() => {
            startVadAndRecording()
          }, 500)
        }
      }
    })

    return () => unsubscribe()
  }, [isLoopMode, startVadAndRecording, isWaitingForResponse])

  return (
    <>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <ThinScreen isVisible={isRecording || !!speechChunks} />
      {/*<ThinScreen isVisible={true} />*/}
    </>
  )
}
