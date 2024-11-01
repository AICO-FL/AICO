export type AIService = 'openai' | 'anthropic' | 'dify'

export interface AIServiceConfig {
  openai: { key: string; model: string }
  anthropic: { key: string; model: string }
  dify: {
    key: string
    url: string
    conversationId: string
  }
}

export type AIVoice = 'stylebertvits2' | 'elevenlabs' | 'openai'

export type Language = 'en' | 'ja' | 'ko' | 'zh' | 'th' // ISO 639-1

export const LANGUAGES: Language[] = ['en', 'ja', 'ko', 'zh', 'th']

export const isLanguageSupported = (language: string): language is Language =>
  LANGUAGES.includes(language as Language)

export type VoiceLanguage = 'en-US' | 'ja-JP' | 'ko-KR' | 'zh-TW'
