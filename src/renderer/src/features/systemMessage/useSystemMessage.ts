import { useEffect, useState } from 'react'
import { speakCharacter } from '../messages/speakCharacter'
import axios from 'axios'
import homeStore from '../stores/home'

const useSystemMessage = () => {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const response = await axios.get('/api/get-speak-message')
        if (response.data.isNew) {
          setMessage(response.data.message)
          // メッセージが更新された場合のみ音声合成と読み上げを行う
          speakCharacter({
            expression: 'neutral', // 適切なEmotionTypeを指定
            talk: {
              style: 'talk', // 適切なTalkStyleを指定
              message: response.data.message
            }
          })
          console.log('System message updated:', response.data.message)

          // homeStoreのchatLogにメッセージを追加
          homeStore.setState((state) => ({
            chatLog: [...state.chatLog, { role: 'assistant', content: response.data.message }]
          }))
        } else {
          console.log('System message not updated.') // メッセージが更新されなかったことをログに出力
        }
      } catch (error) {
        console.error('Error fetching message:', error)
      }
    }

    const intervalId = setInterval(fetchMessage, 60000) // 1分ごとに実行

    return () => clearInterval(intervalId) // コンポーネントがアンマウントされたらインターバルをクリア
  }, [])

  return message
}

export default useSystemMessage
