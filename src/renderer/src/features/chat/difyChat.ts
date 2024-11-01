import settingsStore from '../stores/settings'
import { Message } from '../messages/messages'
import { processQueue, QueueItem } from './sendAvatorworks'

export async function getDifyChatResponseStream(
  messages: Message[],
  apiKey: string,
  url: string,
  initialConversationId?: string
): Promise<ReadableStream<string> | null> {
  if (!apiKey) throw new Error('Invalid API Key')

  // 既存のconversationIdを優先使用
  const conversationId = initialConversationId || settingsStore.getState().difyConversationId
  console.log('Using Conversation ID:', conversationId)

  const messageQueue: QueueItem[] = []

  const requestBody = {
    inputs: {},
    query: messages[messages.length - 1].content,
    response_mode: 'streaming',
    user: 'aico',
    files: [],
    conversation_id: conversationId // リクエストボディにconversationIdを追加
  }

  if (requestBody.query) {
    messageQueue.push({ text: requestBody.query, senderType: 'user' })
  }

  try {
    const requestUrl = conversationId ? `${url}?conversation_id=${conversationId}` : url
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Dify API request failed: ${response.status} - ${errorBody}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to get response body')

    return new ReadableStream({
      async start(controller) {
        let buffer = ''
        let isSearching = false
        let completeAnswer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const textChunk = new TextDecoder('utf-8').decode(value)
            buffer += textChunk

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data:')) continue

              try {
                const data = JSON.parse(line.slice(5))

                // 初回応答時にconversationIdを保存
                if (!conversationId && data.conversation_id) {
                  settingsStore.setState({ difyConversationId: data.conversation_id })
                }

                switch (data.event) {
                  case 'message':
                  case 'agent_message':
                    if (isSearching) {
                      controller.enqueue('[SEARCHING_END]')
                      isSearching = false
                    }
                    if (data.answer) {
                      controller.enqueue(data.answer)
                      completeAnswer += data.answer
                    }
                    break

                  case 'agent_thought':
                    if (!isSearching) {
                      controller.enqueue('[SEARCHING_START]')
                      isSearching = true
                    }
                    break

                  case 'error':
                    controller.error(new Error(data.message))
                    break
                }
              } catch (error) {
                console.error('Error parsing JSON:', error)
              }
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          if (isSearching) {
            controller.enqueue('[SEARCHING_END]')
          }
          if (completeAnswer) {
            messageQueue.push({
              text: completeAnswer,
              senderType: 'aico',
              conversationId
            })
            if (conversationId) {
              await processQueue(messageQueue, conversationId)
            }
          }
          controller.close()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching from Dify API:', error)
    throw error
  }
}
