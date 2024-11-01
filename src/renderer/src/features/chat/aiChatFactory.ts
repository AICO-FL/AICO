import { Message } from '../messages/messages'
import { AIService, AIServiceConfig } from '../constants/settings'
import { getAnthropicChatResponseStream } from './anthropicChat'
import { getDifyChatResponseStream } from './difyChat'
import { getOpenAIChatResponseStream } from './openAiChat'

export async function getAIChatResponseStream(
  service: AIService,
  messages: Message[],
  config: AIServiceConfig
): Promise<ReadableStream<string> | null> {
  switch (service) {
    case 'openai':
      return getOpenAIChatResponseStream(messages, config.openai.key, config.openai.model)
    case 'anthropic':
      return getAnthropicChatResponseStream(messages, config.anthropic.key, config.anthropic.model)
    case 'dify':
      return getDifyChatResponseStream(
        messages,
        config.dify.key,
        config.dify.url,
        config.dify.conversationId
      )
    default:
      throw new Error(`Unsupported AI service: ${service}`)
  }
}
