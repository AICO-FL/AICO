import { Img } from 'react-image'
import { useEffect, useRef, useState } from 'react'

import homeStore from '../features/stores/home'
import settingsStore from '../features/stores/settings'

export const ChatLog = () => {
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const characterName = settingsStore((s) => s.characterName)
  const messages = homeStore((s) => s.chatLog)
  const assistantMessage = homeStore((s) => s.assistantMessage)
  const chatProcessing = homeStore((s) => s.chatProcessing)

  const [streamedMessages, setStreamedMessages] = useState(messages)

  useEffect(() => {
    if (chatProcessing && assistantMessage) {
      // 改行コードを2重にしないために、連続する改行を1つに置き換える
      const sanitizedMessage = assistantMessage.replace(/\n{2,}/g, '\n')
      setStreamedMessages([...messages, { role: 'assistant', content: sanitizedMessage }])
    } else {
      setStreamedMessages(messages)
    }
  }, [messages, assistantMessage, chatProcessing])

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    })
  }, [streamedMessages])

  return (
    <div className="fixed inset-x-0 top-[45%] mx-auto w-col-span-7 max-w-full h-[55vh] pt-64 z-20">
      <div className="max-h-full px-16 pb-104 pt-64 overflow-y-auto scroll-hidden">
        {[...streamedMessages].reverse().map((msg, i) => {
          return (
            <div key={i} ref={i === 0 ? chatScrollRef : null}>
              {Array.isArray(msg.content) ? (
                <>
                  <Chat
                    role={msg.role}
                    message={msg.content[0].text}
                    characterName={characterName}
                  />
                  <ChatImage
                    role={msg.role}
                    imageUrl={msg.content[1].image_url.url}
                    characterName={characterName}
                  />
                </>
              ) : (
                <Chat role={msg.role} message={msg.content} characterName={characterName} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Chat = ({
  role,
  message,
  characterName
}: {
  role: string
  message: string
  characterName: string
}) => {
  const roleColor = role !== 'user' ? 'bg-secondary text-white ' : 'bg-base text-primary'
  const roleText = role !== 'user' ? 'text-secondary' : 'text-custom-text-primary'
  const justifyContent = role === 'user' ? 'justify-end' : 'justify-start'

  return (
    <div className={`flex ${justifyContent} my-16`}>
      <div className="inline-block max-w-[32rem]" style={{ width: 'fit-content' }}>
        {role === 'code' ? (
          <pre className="whitespace-pre-wrap break-words bg-[#1F2937] text-white p-16 rounded-8">
            <code className="font-mono text-sm">{message}</code>
          </pre>
        ) : (
          <>
            <div className={`px-24 py-8 rounded-t-8 font-bold tracking-wider ${roleColor}`}>
              {role !== 'user' ? characterName || 'CHARACTER' : 'YOU'}
            </div>
            <div className="px-24 py-16 bg-white rounded-b-8">
              <div className={`typography-16 font-bold ${roleText} whitespace-pre-wrap text-sm`}>
                {message}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ChatImageコンポーネントも同様に更新
const ChatImage = ({
  role,
  imageUrl,
  characterName
}: {
  role: string
  imageUrl: string
  characterName: string
}) => {
  const justifyContent = role === 'user' ? 'justify-end' : 'justify-start'

  return (
    <div className={`flex ${justifyContent} my-16`}>
      <div className="inline-block max-w-[32rem]" style={{ width: 'fit-content' }}>
        <Img src={imageUrl} alt="Generated Image" className="rounded-8" width={512} height={512} />
      </div>
    </div>
  )
}
