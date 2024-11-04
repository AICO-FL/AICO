/*
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import homeStore, { HomeState } from '../features/stores/home';
import { SpeechChunks } from '../features/sileoVAD/SpeechChunks';
import { bindKey } from '../utils/bindKey';
import settingsStore, { setDetectedLanguage } from '../features/stores/settings';
import { processAndEncodeAudio } from '../features/audioProcessor/speechAudioProcessor';
import { OpenAI } from 'openai';
import { ThinScreen } from './thinScreen';

type Props = {
  onChatProcessStart: (text: string) => void;
};

export const MessageInputContainer = ({ onChatProcessStart }: Props) => {
  const chatProcessing = homeStore((s: HomeState) => s.chatProcessing);
  const [userMessage, setUserMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 録音関連の状態
  const [isRecording, setIsRecording] = useState(false);
  const [isVadActive, setIsVadActive] = useState(false);
  const [speechChunks, setSpeechChunks] = useState<SpeechChunks | null>(null);

  // ボタンの状態
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [isSButtonLocked, setIsSButtonLocked] = useState(false);

  // ループモードと処理状態
  const [isLoopMode, setIsLoopMode] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const LOOP_TIMEOUT = 10000; // 10秒

  const loopTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const config = window.api?.getConfig();
  const openaiApiKey = config?.General?.OpenAI_API_Key;

  const openai = useMemo(() => {
    if (!openaiApiKey) return null;
    return new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true,
    });
  }, [openaiApiKey]);

  // 言語コードが有効かどうかをチェックする関数
  const isValidLanguageCode = (code: string): boolean => {
    const validCodes = ['ja', 'en', 'zh'];
    return validCodes.includes(code);
  };

  // 基本的な音声制御機能
  const stopVadAndRecording = useCallback(async () => {
    if (speechChunks) {
      console.log('Stopping VAD and recording...');
      await speechChunks.stop();
      await speechChunks.close();
      setSpeechChunks(null);
      setIsRecording(false);
      setIsVadActive(false);
      setIsWaitingForResponse(false);
      console.log('VAD and recording stopped');
    }
  }, [speechChunks]);

  // 音声認識の状態をリセット
  const resetVoiceRecognitionState = useCallback(() => {
    setError(null);
    setIsWaitingForResponse(false);
    setRetryCount(0);
  }, []);

  // エラー処理
  const handleVoiceRecognitionError = useCallback((errorType?: string) => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount((prev) => prev + 1);
      const errorMessage = errorType === 'quiet' 
        ? 'マイクの音量が小さすぎます。'
        : errorType === 'loud'
        ? 'マイクの音量が大きすぎます。'
        : '音声の処理に失敗しました。';
      setError(errorMessage);
      return true;
    }
    setError('音声を認識できませんでした。録音を終了します。');
    setIsLoopMode(false);
    setRetryCount(0);
    return false;
  }, [retryCount, MAX_RETRIES]);

  // Whisper APIとの通信
  const sendAudioToWhisper = useCallback(async (processedFile: File) => {
    if (!openai) throw new Error('OpenAI APIキーが設定されていません。');

    const { selectLanguage, isAutoLanguageDetection } = settingsStore.getState();
    const transcriptionOptions = {
      file: processedFile,
      model: 'whisper-1',
      response_format: 'verbose_json' as const,
      ...(!isAutoLanguageDetection && isValidLanguageCode(selectLanguage)
        ? { language: selectLanguage }
        : {}),
    };

    const response = await openai.audio.transcriptions.create(transcriptionOptions);
    if (!response || !response.text) {
      throw new Error('Invalid response from Whisper API');
    }

    return {
      text: response.text,
      language: response.language
    };
  }, [openai]);

  // ループタイマーを開始する関数
  const startLoopTimer = useCallback(() => {
    if (loopTimeoutIdRef.current) {
      clearTimeout(loopTimeoutIdRef.current);
    }
    if (isAIProcessing || isWaitingForResponse) {
      return;
    }

    loopTimeoutIdRef.current = setTimeout(() => {
      if (!isRecording && isVadActive && !isAIProcessing && !isWaitingForResponse) {
        setIsLoopMode(false);
        stopVadAndRecording();
      }
    }, LOOP_TIMEOUT);
  }, [isAIProcessing, isWaitingForResponse, isRecording, isVadActive, stopVadAndRecording]);

  // 音声処理のメイン関数
  const processAndSendAudioToWhisper = useCallback(async (audioBlob: Blob) => {
    setIsSButtonLocked(true);
    setIsWaitingForResponse(true);
    setIsAIProcessing(true);

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const result = await processAndEncodeAudio(arrayBuffer, 16000);

      if (!result.buffer) {
        const shouldRetry = handleVoiceRecognitionError(result.error);
        if (shouldRetry && isLoopMode) {
          setTimeout(() => {
            resetVoiceRecognitionState();
            startVadAndRecording();
          }, 1100);
        }
        return;
      }

      const processedFile = new File([result.buffer], 'audio.wav', {
        type: 'audio/wav',
        lastModified: Date.now(),
      });

      const { text, language } = await sendAudioToWhisper(processedFile);
      
      if (!text.trim()) {
        const shouldRetry = handleVoiceRecognitionError();
        if (shouldRetry && isLoopMode) {
          setTimeout(() => {
            resetVoiceRecognitionState();
            startVadAndRecording();
          }, 1000);
        }
        return;
      }

      setRetryCount(0);
      setUserMessage(text);
      setDetectedLanguage(language);
      onChatProcessStart(text);

    } catch (error) {
      console.error('Error in voice processing:', error);
      setError('音声の処理と送信中にエラーが発生しました。');
      setIsLoopMode(false);
    } finally {
      setIsSButtonLocked(false);
      setIsWaitingForResponse(false);
      setIsAIProcessing(false);
    }
  }, [
    isLoopMode,
    handleVoiceRecognitionError,
    resetVoiceRecognitionState,
    sendAudioToWhisper,
    onChatProcessStart,
  ]);

  // VAD開始処理
  const startVadAndRecording = useCallback(async () => {
    if (isAIProcessing) {
      console.log('AI処理中のため、音声認識を開始できません');
      return;
    }

    try {
      resetVoiceRecognitionState();
      await stopVadAndRecording();

      const chunks = new SpeechChunks(
        () => {
          setIsVadActive(true);
          setIsRecording(true);
          setRetryCount(0);
        },
        async (blob) => {
          await stopVadAndRecording();
          await processAndSendAudioToWhisper(blob);
        }
      );

      await chunks.start();
      setSpeechChunks(chunks);
      setIsVadActive(true);

      if (isLoopMode) {
        startLoopTimer();
      }
    } catch (error) {
      console.error('Error starting VAD:', error);
      setError('マイクの使用を許可してください。');
      setIsRecording(false);
      setIsVadActive(false);
      setIsLoopMode(false);
    }
  }, [
    isAIProcessing,
    resetVoiceRecognitionState,
    stopVadAndRecording,
    processAndSendAudioToWhisper,
    isLoopMode,
    startLoopTimer
  ]);

  // マイクボタンのクリックハンドラー
  const handleClickMicButton = useCallback(() => {
    if (isButtonDisabled || isSButtonLocked) return;

    setIsButtonDisabled(true);
    setTimeout(() => setIsButtonDisabled(false), 3000);

    if (isRecording || speechChunks) {
      stopVadAndRecording();
      setIsLoopMode(false);
    } else {
      startVadAndRecording();
    }
  }, [
    isRecording,
    speechChunks,
    startVadAndRecording,
    stopVadAndRecording,
    isButtonDisabled,
    isSButtonLocked,
  ]);

  // ループモードのタイマー管理
  useEffect(() => {
    if (isLoopMode && !isAIProcessing && !isWaitingForResponse) {
      startLoopTimer();
    } else if (loopTimeoutIdRef.current) {
      clearTimeout(loopTimeoutIdRef.current);
      loopTimeoutIdRef.current = null;
    }
  }, [isLoopMode, isAIProcessing, isWaitingForResponse, startLoopTimer]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (loopTimeoutIdRef.current) {
        clearTimeout(loopTimeoutIdRef.current);
      }
    };
  }, []);

  // キーボードイベントのバインド
  useEffect(() => {
    const handleKeyPress = (key: string) => {
      if (isAIProcessing) {
        return;
      }

      if (key.toLowerCase() === 's' && !isSButtonLocked) {
        console.log('Sキーが押されました');
        if (isLoopMode) {
          setIsLoopMode(false);
          stopVadAndRecording();
          return;
        }
        setIsLoopMode((prev) => !prev);
        handleClickMicButton();
      }
    };

    const unbindKey = bindKey(handleKeyPress);
    return () => {
      unbindKey();
    };
  }, [
    handleClickMicButton,
    isSButtonLocked,
    isLoopMode,
    isAIProcessing,
    stopVadAndRecording,
  ]);

  // チャット処理が終了したときの処理
  useEffect(() => {
    if (!chatProcessing) {
      setUserMessage('');
      setIsWaitingForResponse(false);
    }
  }, [chatProcessing]);

  // SpeechChunksのクリーンアップ
  useEffect(() => {
    return () => {
      if (speechChunks) {
        speechChunks.close();
      }
    };
  }, [speechChunks]);

  // ストアのサブスクライブ
  useEffect(() => {
    const unsubscribe = homeStore.subscribe((state: HomeState) => {
      if (state.chatProcessingCount > 0) {
        setIsAIProcessing(true);
        setIsWaitingForResponse(true);
        stopVadAndRecording();
      } else {
        setIsAIProcessing(false);
        setIsSButtonLocked(false);
        setIsWaitingForResponse(false);

        if (isLoopMode) {
          console.log('AI処理完了、ループモードで音声認識を再開します');
          startVadAndRecording();
        }
      }
    });

    return () => unsubscribe();
  }, [isLoopMode, startVadAndRecording, stopVadAndRecording]);

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
  );
};
*/

//古い方
/*
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

  const stopVadAndRecording = useCallback(() => {
    if (speechChunks) {
      console.log('Stopping VAD and recording...')
      speechChunks.stop()
      setSpeechChunks(null)
      setIsRecording(false)
      setIsVadActive(false)
      setIsWaitingForResponse(false)
      console.log('VAD and recording stopped')
    }
  }, [speechChunks])
  
  const startLoopTimer = useCallback(() => {
    if (loopTimeoutId) {
      clearTimeout(loopTimeoutId)
    }
    if (isAIProcessing || isWaitingForResponse) {
      return
    }
  
    const timeoutId = setTimeout(() => {
      if (!isRecording && isVadActive && !isAIProcessing && !isWaitingForResponse) {
        setIsLoopMode(false)
        stopVadAndRecording()
      }
    }, LOOP_TIMEOUT)
    setLoopTimeoutId(timeoutId)
  }, [loopTimeoutId, isAIProcessing, isWaitingForResponse, isRecording, isVadActive, stopVadAndRecording])

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
          // ここで確実に停止処理を行う
          if (speechChunks) {
            await speechChunks.stop()
            await speechChunks.close()
            setSpeechChunks(null)
          }
          setIsRecording(false)
          setIsVadActive(false)
          
          // 停止処理が完了してから音声処理を開始
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
      startLoopTimer()
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
    setIsAIProcessing(true)

    // 既存のSpeechChunksインスタンスを確実に停止
    if (speechChunks) {
      await speechChunks.stop()
      setSpeechChunks(null)
    }
    setIsRecording(false)
    setIsVadActive(false)

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
            // タイマーをクリアする処理を追加
            const clearErrorTimer = setTimeout(() => {
              setError(null)
            }, 1000)
    
            // リトライ用のタイマー
            const retryTimer = setTimeout(() => {
              if (isLoopMode) {
                startVadAndRecording()
              }
            }, 1100) // エラーメッセージが消えた後に開始
    
            return () => {
              clearTimeout(clearErrorTimer)
              clearTimeout(retryTimer)
            }
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
          setIsAIProcessing(false)
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
    if (isLoopMode && !isAIProcessing && !isWaitingForResponse) {
      startLoopTimer()
    } else if (loopTimeoutId) {
      clearTimeout(loopTimeoutId)
      setLoopTimeoutId(null)
    }
  }, [isLoopMode, loopTimeoutId, isAIProcessing, isWaitingForResponse])

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
        // AI処理開始時に確実にVADを停止
        if (speechChunks) {
          speechChunks.stop()
          setSpeechChunks(null)
        }
        setIsRecording(false)
        setIsVadActive(false)
        setIsWaitingForResponse(true)
      } else {
        setIsAIProcessing(false)
        setIsSButtonLocked(false)
        setIsWaitingForResponse(false)
        
        if (isLoopMode) {
          console.log('AI処理完了、ループモードで音声認識を再開します')
          startVadAndRecording()
        }
      }
    })

    return () => unsubscribe()
  }, [isLoopMode, startVadAndRecording])

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
*/