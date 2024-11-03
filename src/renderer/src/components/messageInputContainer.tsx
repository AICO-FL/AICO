import { useState, useEffect, useCallback, useRef } from 'react'
import homeStore, { HomeState } from '../features/stores/home'
import { SpeechChunks } from '../features/sileoVAD/SpeechChunks'
import { bindKey } from '../utils/bindKey'
import settingsStore, { setDetectedLanguage } from '../features/stores/settings'
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
  const [isVadActive, setIsVadActive] = useState(false)
  const [speechChunks, setSpeechChunks] = useState<SpeechChunks | null>(null)
  const [isButtonDisabled, setIsButtonDisabled] = useState(false)
  const [isSButtonLocked, setIsSButtonLocked] = useState(false)
  const [isLoopMode, setIsLoopMode] = useState(false)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3
  const [isAIProcessing, setIsAIProcessing] = useState(false) 
  const [loopTimeoutId, setLoopTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const LOOP_TIMEOUT = 10000 // 10秒

  // 関数の参照を保持するためのref
  const stopVadAndRecordingRef = useRef<() => void>()
  const startLoopTimerRef = useRef<() => void>()

  // stopVadAndRecordingの実装
  stopVadAndRecordingRef.current = () => {
    if (speechChunks) {
      console.log('Stopping VAD and recording...')
      speechChunks.stop()
      setSpeechChunks(null)
      setIsRecording(false)
      setIsVadActive(false)
      setIsWaitingForResponse(false)
      console.log('VAD and recording stopped')
    }
  }

  // startLoopTimerの実装
  // startLoopTimerの実装を修正
  startLoopTimerRef.current = () => {
    if (loopTimeoutId) {
      clearTimeout(loopTimeoutId)
    }
    // isRecordingがfalseのまま10秒経過したら終了
    const timeoutId = setTimeout(() => {
      if (!isRecording) {
        setIsLoopMode(false)
        stopVadAndRecordingRef.current?.()
      }
    }, LOOP_TIMEOUT)
    setLoopTimeoutId(timeoutId)
  }

  // VADと録音を開始する
  const startVadAndRecording = useCallback(async () => {
    if (isAIProcessing) {
      console.log('AI処理中のため、音声認識を開始できません')
      return
    }

    try {
      console.log('MessageInputContainer: Starting VAD and recording...')
      setError(null)
      setIsWaitingForResponse(false)
      
      if (speechChunks) {
        await speechChunks.stop()
      }

      const chunks = new SpeechChunks(
        () => {
          console.log('MessageInputContainer: Speech started')
          setIsVadActive(true)
          setIsRecording(true)
          setRetryCount(0)
        },
        async (blob) => {
          console.log('MessageInputContainer: Speech ended')
          setIsRecording(false)
          setIsVadActive(false)
          setSpeechChunks(null)
          await processAndSendAudioToWhisper(blob)
        }
      )
      console.log('MessageInputContainer: SpeechChunks created')
      await chunks.start()
      console.log('MessageInputContainer: SpeechChunks started')
      setIsVadActive(true)
      setSpeechChunks(chunks)
      setError(null)
      // VADが開始された時点でタイマーを開始
      startLoopTimerRef.current?.()
      console.log('MessageInputContainer: VAD and recording started successfully')
    } catch (error) {
      console.error('MessageInputContainer: Error starting VAD and recording:', error)
      setError('マイクの使用を許可してください。')
      setIsRecording(false)
      setIsVadActive(false)
      setIsLoopMode(false)
    }
  }, [isAIProcessing, isLoopMode, speechChunks])

  const processAndSendAudioToWhisper = async (audioBlob: Blob) => {
    setIsSButtonLocked(true)
    setIsWaitingForResponse(true)

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
      const result = await processAndEncodeAudio(arrayBuffer, 16000)

      if (!result.buffer) {
        if (retryCount < MAX_RETRIES) {
          setRetryCount((prev) => prev + 1)
          const errorMessage = result.error === 'quiet'
            ? 'マイクの音量が小さすぎます。もう少し大きな声で話してください。'
            : result.error === 'loud'
              ? 'マイクの音量が大きすぎます。もう少し離れて話してください。'
              : '音声の処理に失敗しました。もう一度お試しください。'
          
          setError(errorMessage)
          setIsSButtonLocked(false)
          setIsWaitingForResponse(false)
          
          if (isLoopMode) {
            const timer = setTimeout(() => {
              setError(null)
              if (isLoopMode) {
                startVadAndRecording()
              }
            }, 1000)
            
            return () => clearTimeout(timer)
          }
          return
        } else {
          setError('音声を認識できませんでした。録音を終了します。')
          setIsLoopMode(false)
          setRetryCount(0)
          setIsSButtonLocked(false)
          setIsWaitingForResponse(false)
          return
        }
      }

      const processedFile = new File([result.buffer], 'audio.wav', {
        type: 'audio/wav',
        lastModified: Date.now()
      })

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
        if (retryCount < MAX_RETRIES) {
          setRetryCount((prev) => prev + 1)
          setError('音声を認識できませんでした。もう一度お話しください。')
          setIsSButtonLocked(false)
          setIsWaitingForResponse(false)
          if (isLoopMode) {
            setTimeout(() => {
              startVadAndRecording()
            }, 1000)
          }
          return
        } else {
          setError('音声を認識できませんでした。録音を終了します。')
          setIsLoopMode(false)
          setRetryCount(0)
          setIsSButtonLocked(false)
          setIsWaitingForResponse(false)
          return
        }
      }

      setRetryCount(0)
      setUserMessage(transcribedText)
      setDetectedLanguage(detectedLanguage)
      setIsAIProcessing(true)
      onChatProcessStart(transcribedText)
      console.log('Detected language:', detectedLanguage)
    } catch (error) {
      console.error('Error processing and sending audio to Whisper:', error)
      setError('音声の処理と送信中にエラーが発生しました。')
      setIsLoopMode(false)
      setIsSButtonLocked(false)
      setIsWaitingForResponse(false)
      setIsAIProcessing(false)
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
      stopVadAndRecordingRef.current?.()
      setIsLoopMode(false)
    } else {
      startVadAndRecording()
    }
  }, [
    isRecording,
    speechChunks,
    startVadAndRecording,
    isButtonDisabled,
    isSButtonLocked
  ])

  useEffect(() => {
    if (isLoopMode) {
      startLoopTimerRef.current?.()
    } else if (loopTimeoutId) {
      clearTimeout(loopTimeoutId)
      setLoopTimeoutId(null)
    }
  }, [isLoopMode, loopTimeoutId])

  useEffect(() => {
    return () => {
      if (loopTimeoutId) {
        clearTimeout(loopTimeoutId)
      }
    }
  }, [loopTimeoutId])

  useEffect(() => {
    const handleKeyPress = (key: string) => {
      if (isAIProcessing) {
        return
      }

      if (key.toLowerCase() === 's' && !isSButtonLocked) {
        console.log('Sキーが押されました')
        if (isLoopMode) {
          setIsLoopMode(false)
          stopVadAndRecordingRef.current?.()
          return
        }
        setIsLoopMode((prev) => !prev)
        handleClickMicButton()
      }
    }

    const unbindKey = bindKey(handleKeyPress)
    return () => {
      unbindKey()
    }
  }, [handleClickMicButton, isSButtonLocked, isLoopMode, isAIProcessing])

  useEffect(() => {
    if (!chatProcessing) {
      setUserMessage('')
      setIsWaitingForResponse(false)
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
        setIsAIProcessing(true)
      } else {
        setIsAIProcessing(false)
        setIsSButtonLocked(false)
        setIsWaitingForResponse(false)
        
        if (isLoopMode) {
          setTimeout(() => {
            if (!isAIProcessing) {
              startVadAndRecording()
            }
          }, 500)
        }
      }
    })

    return () => unsubscribe()
  }, [isLoopMode, startVadAndRecording, isAIProcessing])

  return (
    <>
      <ThinScreen 
        isVisible={true}
        isLoopMode={isLoopMode}
        isVadActive={isVadActive}
        isRecording={isRecording}
        isWaitingForResponse={isWaitingForResponse}
        chatProcessing={isAIProcessing}
        error={error}
      />
    </>
  )
}