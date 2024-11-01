import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from './detectionStore'
import { speakCharacter } from '../messages/speakCharacter'
import homeStore from '../stores/home'
import settingsStore from '../stores/settings'

export function useDetectionEffect() {
  const isHeadDetected = useSelector((state: RootState) => state.detection.isHeadDetected)
  const hasGreeted = useRef(true) // 挨拶済みフラグ (true = 挨拶可能)
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null) // 顔検出継続時間計測用タイマー
  const noDetectionTimerRef = useRef<NodeJS.Timeout | null>(null) // 非検出時のクールダウンタイマー
  const startTimeRef = useRef<number | null>(null) // 検出開始時刻
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null) // 長時間非検出時のリセットタイマー


  useEffect(() => {
    if (isHeadDetected) {
      // 顔検出中の処理

      console.log('検出状態:', {
        isHeadDetected,
        hasGreeted: hasGreeted.current,
        startTime: startTimeRef.current,
        detectionTimer: !!detectionTimerRef.current
      })

      // リセットタイマーがある場合はクリア
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }

      // 非検出タイマーが動いている場合はクリア
      if (noDetectionTimerRef.current) {
        console.log('非検出タイマーをクリア')
        clearTimeout(noDetectionTimerRef.current)
        noDetectionTimerRef.current = null
      }

      // 検出継続時間計測用タイマーの開始（重複防止）
      if (!detectionTimerRef.current) {
        startTimeRef.current = Date.now() // 検出開始時刻を記録
        detectionTimerRef.current = setInterval(() => {
          const detectionDuration = Date.now() - startTimeRef.current!

          // 800ms以上検出かつ挨拶可能な場合
          if (detectionDuration >= 800 && hasGreeted.current) {
            handleWelcomeMessage()
            hasGreeted.current = false // 挨拶済みフラグを設定

            // 挨拶完了後タイマーをクリア
            if (detectionTimerRef.current) {
              clearInterval(detectionTimerRef.current)
              detectionTimerRef.current = null
            }
            startTimeRef.current = null
          }
        }, 100)
      }
    } else {
      // 顔非検出中の処理

      console.log('非検出状態:', {
        isHeadDetected,
        hasGreeted: hasGreeted.current,
        noDetectionTimer: !!noDetectionTimerRef.current
      })

      // 検出タイマーのクリア（顔を見失ったため）
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current)
        detectionTimerRef.current = null
        startTimeRef.current = null
      }

      // 非検出クールダウンタイマーの開始（10秒後に再挨拶可能に）
      if (!noDetectionTimerRef.current) {
        noDetectionTimerRef.current = setTimeout(() => {
          hasGreeted.current = true // 挨拶可能フラグを設定
          noDetectionTimerRef.current = null
        }, 10000)
      }

      // 非検出開始時にリセットタイマーを開始
      if (!resetTimerRef.current) {
        console.log('リセットタイマー開始')
        resetTimerRef.current = setTimeout(() => {
          console.log('1分経過 - ストアをリセット')
          homeStore.setState({ chatLog: [] })
          settingsStore.setState({
            selectLanguage: 'ja',
            selectVoice: 'stylebertvits2',
            selectVoiceLanguage: 'ja-JP',
            isAutoLanguageDetection: false,
            difyConversationId: ''
          })
          resetTimerRef.current = null
        }, 30000)
      }
    }

    // クリーンアップ関数
    return () => {
      // コンポーネントのアンマウント時にすべてのタイマーをクリア
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current)
      if (noDetectionTimerRef.current) clearTimeout(noDetectionTimerRef.current)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [isHeadDetected])

  const handleWelcomeMessage = async () => {
    try {
      const welcomeMessage = 'こんにちは'

      // 状態の更新を1回にまとめる
      homeStore.setState({
        chatLog: [
          ...homeStore.getState().chatLog,
          {
            role: 'assistant',
            content: welcomeMessage
          }
        ]
      })

      // 音声再生は変更なし
      speakCharacter(
        {
          expression: 'neutral',
          talk: {
            style: 'talk',
            message: welcomeMessage
          }
        },
        () => {
          homeStore.setState({ chatProcessing: true })
        },
        () => {
          homeStore.setState({ chatProcessing: false })
        }
      )
    } catch (error) {
      console.error('挨拶ができませんでした:', error)
    }
  }
}
