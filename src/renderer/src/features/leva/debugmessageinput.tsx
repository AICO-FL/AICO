import { useControls, button, folder } from 'leva'
import { useCallback } from 'react'
import { handleSendChatFn } from '../../components/handlers'
import { useTranslation } from 'react-i18next'

export const DebugMessageInput: React.FC<{ store: any }> = ({ store }) => {
  const { t } = useTranslation()

  const sendMessage = useCallback(
    (message: string) => {
      if (message.trim() !== '') {
        const handleSendChat = handleSendChatFn({
          NotConnectedToExternalAssistant: t('NotConnectedToExternalAssistant'),
          APIKeyNotEntered: t('APIKeyNotEntered')
        })
        handleSendChat(message)
        store.setValueAtPath('デバッグメッセージ.debugMessage', '')
      } else {
        console.log('メッセージが空のため送信しませんでした')
      }
    },
    [store, t]
  )

  useControls(
    {
      デバッグメッセージ: folder({
        debugMessage: {
          value: '',
          label: 'LLMへのメッセージ'
        },
        sendMessage: button((get) => {
          const message = get('デバッグメッセージ.debugMessage')
          sendMessage(message)
        })
      })
    },
    { store }
  )

  return null
}
