import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from './detectionStore'
import { speakCharacter } from '../messages/speakCharacter'
import homeStore from '../stores/home'
import settingsStore from '../stores/settings'

export function useDetectionEffect() {
  const isHeadDetected = useSelector((state: RootState) => state.detection.isHeadDetected)
  const isFirstGreeting = useRef(true) // 初回挨拶フラグ
  const detectionStartTime = useRef<number | null>(null) // 検出開始時刻
  const lastGreetingTime = useRef<number>(0) // 最後の挨拶時刻
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null) // リセットタイマー

  useEffect(() => {
    if (isHeadDetected) {
      // 顔検出開始時の処理
      if (detectionStartTime.current === null) {
        detectionStartTime.current = Date.now()

        // 初回挨拶の場合はすぐに挨拶
        if (isFirstGreeting.current) {
          handleWelcomeMessage()
          isFirstGreeting.current = false
          lastGreetingTime.current = Date.now()
        }
      } else {
        // 検出継続時間が2秒を超え、かつ最後の挨拶から30秒以上経過している場合
        const currentTime = Date.now()
        const detectionDuration = currentTime - detectionStartTime.current
        const timeSinceLastGreeting = currentTime - lastGreetingTime.current

        if (detectionDuration >= 2000 && timeSinceLastGreeting >= 30000 && !isFirstGreeting.current) {
          handleWelcomeMessage()
          lastGreetingTime.current = currentTime
          detectionStartTime.current = null // 検出時間をリセット
        }
      }

      // リセットタイマーがある場合はクリア
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    } else {
      // 顔非検出時の処理
      detectionStartTime.current = null

      // 非検出開始時にリセットタイマーを開始（既存のタイマーがない場合のみ）
      if (!resetTimerRef.current) {
        resetTimerRef.current = setTimeout(async () => {
          console.log('30秒経過 - システムをリセット')
          // 先にチャットログをクリアする
          homeStore.setState({ chatLog: [] })
          
          // 少し待ってから他の状態をリセット
          await new Promise(resolve => setTimeout(resolve, 100))
          
          settingsStore.setState({
            selectLanguage: 'ja',
            selectVoice: 'stylebertvits2',
            selectVoiceLanguage: 'ja-JP',
            isAutoLanguageDetection: false,
            difyConversationId: ''
          })
          isFirstGreeting.current = true
          lastGreetingTime.current = 0
          resetTimerRef.current = null
        }, 30000)
      }
    }

    // クリーンアップ関数
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [isHeadDetected])

  const handleWelcomeMessage = async () => {
    try {
      const welcomeMessage = 'いらっしゃいませ'
  
      // まず処理中フラグを立てる
      homeStore.setState({ chatProcessing: true })
  
      // チャットログをクリアしてから新しいメッセージを追加
      homeStore.setState({
        chatLog: [
          {
            role: 'assistant',
            content: welcomeMessage
          }
        ]
      })
  
      await speakCharacter(
        {
          expression: 'neutral',
          talk: {
            style: 'talk',
            message: welcomeMessage
          }
        },
        () => {}, // 既にchatProcessingをtrueにしているので空関数
        () => {
          homeStore.setState({ chatProcessing: false })
        }
      )
    } catch (error) {
      console.error('挨拶ができませんでした:', error)
      // エラー時もフラグを戻す
      homeStore.setState({ chatProcessing: false })
    }
  }
}