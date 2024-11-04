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
  console.log('MessageInputContainer: コンポーネントの初期化');
  
  const chatProcessing = homeStore((s: HomeState) => s.chatProcessing);
  const chatProcessingCount = homeStore((s: HomeState) => s.chatProcessingCount);
  const isProcessing = homeStore((s: HomeState) => s.isProcessing);
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
  const LOOP_TIMEOUT = 10000;

  const loopTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyPressTimeRef = useRef<number>(0);
  const isKeyPressedRef = useRef<boolean>(false);
  const KEY_PRESS_INTERVAL = 1000;

  const config = window.api?.getConfig();
  const openaiApiKey = config?.General?.OpenAI_API_Key;

  const openai = useMemo(() => {
    console.log('OpenAI クライアントの初期化');
    if (!openaiApiKey) {
      console.warn('OpenAI APIキーが設定されていません');
      return null;
    }
    return new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true,
    });
  }, [openaiApiKey]);

  const isValidLanguageCode = (code: string): boolean => {
    console.log(`言語コードの検証: ${code}`);
    const validCodes = ['ja', 'en', 'zh'];
    return validCodes.includes(code);
  };

  const stopVadAndRecording = useCallback(async () => {
    console.log('stopVadAndRecording: 開始');
    
    if (speechChunks) {
      await speechChunks.stop();
      setSpeechChunks(null);
    }
    
    // 確実に状態をリセット
    setIsRecording(false);
    setIsVadActive(false);
    
    // 少し待機して確実にVADを停止
    await new Promise(resolve => setTimeout(resolve, 100));
  }, [speechChunks]);

  const resetVoiceRecognitionState = useCallback(() => {
    console.log('音声認識の状態をリセット');
    setError(null);
    setIsWaitingForResponse(false);
    setRetryCount(0);
  }, []);

  const handleVoiceRecognitionError = useCallback((errorType?: string) => {
    console.log(`音声認識エラーの処理: ${errorType}`);
    if (retryCount < MAX_RETRIES) {
      console.log(`リトライ回数: ${retryCount + 1}/${MAX_RETRIES}`);
      setRetryCount((prev) => prev + 1);
      const errorMessage = errorType === 'quiet' 
        ? 'マイクの音量が小さすぎます。'
        : errorType === 'loud'
        ? 'マイクの音量が大きすぎます。'
        : '音声の処理に失敗しました。';
      setError(errorMessage);
      return true;
    }
    console.log('最大リトライ回数に達しました');
    setError('音声を認識できませんでした。録音を終了します。');
    setIsLoopMode(false);
    setRetryCount(0);
    return false;
  }, [retryCount, MAX_RETRIES]);

  const sendAudioToWhisper = useCallback(async (processedFile: File) => {
    console.log('Whisper APIへの音声送信開始');
    if (!openai) throw new Error('OpenAI APIキーが設定されていません。');

    const { selectLanguage, isAutoLanguageDetection } = settingsStore.getState();
    console.log(`言語設定: ${selectLanguage}, 自動検出: ${isAutoLanguageDetection}`);

    const transcriptionOptions = {
      file: processedFile,
      model: 'whisper-1',
      response_format: 'verbose_json' as const,
      ...(!isAutoLanguageDetection && isValidLanguageCode(selectLanguage)
        ? { language: selectLanguage }
        : {}),
    };

    const response = await openai.audio.transcriptions.create(transcriptionOptions);
    console.log('Whisper APIからのレスポンス受信');
    
    if (!response || !response.text) {
      console.error('Whisper APIからの無効なレスポンス');
      throw new Error('Invalid response from Whisper API');
    }

    console.log(`認識結果: ${response.text}`);
    return {
      text: response.text,
      language: response.language
    };
  }, [openai]);

  const startLoopTimer = useCallback(() => {
    console.log('ループタイマーの開始');
    if (loopTimeoutIdRef.current) {
      console.log('既存のタイマーをクリア');
      clearTimeout(loopTimeoutIdRef.current);
    }
    if (isAIProcessing || isWaitingForResponse || isProcessing) {
      console.log('処理中のためタイマー開始をスキップ');
      return;
    }

    loopTimeoutIdRef.current = setTimeout(() => {
      console.log('ループタイマーのタイムアウト発生');
      if (!isRecording && isVadActive && !isAIProcessing && !isWaitingForResponse && !isProcessing) {
        setIsLoopMode(false);
        stopVadAndRecording();
      }
    }, LOOP_TIMEOUT);
  }, [isAIProcessing, isWaitingForResponse, isRecording, isVadActive, stopVadAndRecording, isProcessing]);

  const processAndSendAudioToWhisper = useCallback(async (audioBlob: Blob) => {
    console.log('音声処理とWhisper送信の開始');
    try {
      setIsSButtonLocked(true);
      setIsWaitingForResponse(true);
      setIsAIProcessing(true);

      await stopVadAndRecording();

      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('音声データの処理開始');
      const result = await processAndEncodeAudio(arrayBuffer, 16000);

      if (!result.buffer) {
        console.warn('音声処理に失敗:', result.error);
        const shouldRetry = handleVoiceRecognitionError(result.error);
        if (shouldRetry && isLoopMode && !isProcessing) {
          resetVoiceRecognitionState();
          if (!isAIProcessing && !isWaitingForResponse && speechChunks) {
            speechChunks.start();
          }
        }
        return;
      }

      const processedFile = new File([result.buffer], 'audio.wav', {
        type: 'audio/wav',
        lastModified: Date.now(),
      });

      console.log('Whisper APIへの送信開始');
      const { text, language } = await sendAudioToWhisper(processedFile);
      
      if (!text.trim()) {
        console.warn('空の認識結果を受信');
        const shouldRetry = handleVoiceRecognitionError();
        if (shouldRetry && isLoopMode && !isProcessing) {
          resetVoiceRecognitionState();
          if (!isAIProcessing && !isWaitingForResponse && speechChunks) {
            speechChunks.start();
          }
        }
        return;
      }

      console.log(`認識成功: ${text}`);
      setRetryCount(0);
      setUserMessage(text);
      setDetectedLanguage(language);

      console.log('チャット処理の開始');
      onChatProcessStart(text);

    } catch (error) {
      console.error('音声処理中のエラー:', error);
      setError('音声の処理と送信中にエラーが発生しました。');
      setIsLoopMode(false);
    } finally {
      setIsAIProcessing(false);
      setIsSButtonLocked(false);
      setIsWaitingForResponse(false);
    } 
  }, [
    isLoopMode,
    handleVoiceRecognitionError,
    resetVoiceRecognitionState,
    sendAudioToWhisper,
    onChatProcessStart,
    isAIProcessing,
    isWaitingForResponse,
    speechChunks,
    stopVadAndRecording,
    isProcessing
  ]);

  const startVadAndRecording = useCallback(async () => {
    console.log('VADと録音の開始処理');
    if (isAIProcessing || isWaitingForResponse || isProcessing) {
      console.log('処理中のため、VAD開始をスキップ', {
        isAIProcessing,
        isWaitingForResponse,
        isProcessing
      });
      return;
    }

    try {
      console.log('VAD初期化開始', { 
        現在のspeechChunks: speechChunks ? 'exists' : 'null',
        isRecording,
        isVadActive 
      });

      resetVoiceRecognitionState();

      if (speechChunks) {
        console.log('既存のVADインスタンスを停止');
        await stopVadAndRecording();
      }

      console.log('新しいVADインスタンスを作成');
      const chunks = new SpeechChunks(
        () => {
          console.log('VADコールバック: 音声検出開始');
          if (isAIProcessing || isWaitingForResponse || isProcessing) {
            stopVadAndRecording();
            return;
          }
          setIsVadActive(true);
          setIsRecording(true);
          setRetryCount(0);
        },
        async (blob) => {
          console.log('VADコールバック: 音声データ受信');
          await stopVadAndRecording();
          if (!isAIProcessing && !isProcessing) {
            await processAndSendAudioToWhisper(blob);
          }
        }
      );
      setSpeechChunks(chunks);
      await chunks.start();

      setIsVadActive(true);
      console.log('VAD開始完了');

      if (isLoopMode && !isProcessing) {
        startLoopTimer();
      }
    } catch (error) {
      console.error('VAD開始エラー:', error);
      setError('マイクの使用を許可してください。');
      setIsRecording(false);
      setIsVadActive(false);
      setIsLoopMode(false);
    }
  }, [
    isAIProcessing,
    isWaitingForResponse,
    isProcessing,
    resetVoiceRecognitionState,
    speechChunks,
    stopVadAndRecording,
    processAndSendAudioToWhisper,
    isLoopMode,
    startLoopTimer
  ]);

  const handleClickMicButton = useCallback(() => {
    console.log('マイクボタンクリック');
    if (isButtonDisabled || isSButtonLocked) {
      console.log('ボタンは無効化されています');
      return;
    }

    setIsButtonDisabled(true);
    setTimeout(() => setIsButtonDisabled(false), 3000);

    if (isRecording || speechChunks) {
      console.log('録音停止処理');
      stopVadAndRecording();
      setIsLoopMode(false);
    } else {
      console.log('録音開始処理');
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

  useEffect(() => {
    console.log('ループモード状態変更の検出', { isLoopMode, isAIProcessing, isWaitingForResponse });
    if (isLoopMode && !isAIProcessing && !isWaitingForResponse && !isProcessing) {
      startLoopTimer();
    } else if (loopTimeoutIdRef.current) {
      clearTimeout(loopTimeoutIdRef.current);
      loopTimeoutIdRef.current = null;
    }
  }, [isLoopMode, isAIProcessing, isWaitingForResponse, startLoopTimer, isProcessing]);

  useEffect(() => {
    console.log('クリーンアップ効果の設定');
    return () => {
      if (speechChunks) {
        console.log('speechChunksのクリーンアップ');
        speechChunks.close();
      }
      if (loopTimeoutIdRef.current) {
        console.log('ループタイマーのクリーンアップ');
        clearTimeout(loopTimeoutIdRef.current);
      }
    };
  }, [speechChunks]);

  useEffect(() => {
    console.log('キーボードイベントリスナーの設定');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 's' && !isKeyPressedRef.current) {
        const currentTime = Date.now();
        if (currentTime - lastKeyPressTimeRef.current >= KEY_PRESS_INTERVAL) {
          console.log('Sキー押下検出');
          isKeyPressedRef.current = true;
          lastKeyPressTimeRef.current = currentTime;
          
          if (isAIProcessing || isProcessing) {
            console.log('AI処理中のためスキップ');
            return;
          }

          if (!isSButtonLocked) {
            if (isLoopMode) {
              console.log('ループモード終了');
              setIsLoopMode(false);
              stopVadAndRecording();
              return;
            }
            console.log('ループモード切り替えとマイク操作');
            setIsLoopMode((prev) => !prev);
            handleClickMicButton();
          }
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 's') {
        console.log('Sキー解放');
        isKeyPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    handleClickMicButton,
    isSButtonLocked,
    isLoopMode,
    isAIProcessing,
    stopVadAndRecording,
    isProcessing
  ]);

  useEffect(() => {
    console.log('チャット処理状態の変更検出', { chatProcessing });
    if (!chatProcessing) {
      setUserMessage('');
    }
  }, [chatProcessing]);

  useEffect(() => {
    console.log('homeStore購読の設定');
    const unsubscribe = homeStore.subscribe((state: HomeState) => {
      console.log('homeStore状態更新', {
        chatProcessing: state.chatProcessing,
        chatProcessingCount: state.chatProcessingCount,
        isProcessing: state.isProcessing
      });
      
      if (isWaitingForResponse) return;
      // チャット処理中またはスタックが残っている場合は何もしない
      if (state.isProcessing) {
        return;
      }

      if (!state.isProcessing && !isAIProcessing ) {
        if (isLoopMode) {
          console.log('ループモードでの音声認識再開');
          startVadAndRecording();
        }
      }
    });

    return () => unsubscribe();
  }, [isLoopMode, startVadAndRecording, isAIProcessing, isWaitingForResponse]);

  return (
    <>
      <ThinScreen
        isVisible={true}
        isLoopMode={isLoopMode}
        isVadActive={isVadActive}
        isRecording={isRecording}
        isWaitingForResponse={isWaitingForResponse}
        chatProcessing={isAIProcessing}
        chatProcessingCount={chatProcessingCount}
        error={error}
      />
    </>
  );
};