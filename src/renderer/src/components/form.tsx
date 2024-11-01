import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { handleSendChatFn } from './handlers'
import { MessageInputContainer } from './messageInputContainer'

export const Form = () => {
  const [delayedText, setDelayedText] = useState('')

  const { t } = useTranslation()
  const handleSendChat = handleSendChatFn({
    NotConnectedToExternalAssistant: t('NotConnectedToExternalAssistant'),
    APIKeyNotEntered: t('APIKeyNotEntered')
  })

  const hookSendChat = useCallback(
    (text: string) => {
      handleSendChat(text)
    },
    [handleSendChat, setDelayedText]
  )

  return <MessageInputContainer onChatProcessStart={hookSendChat} />
}
