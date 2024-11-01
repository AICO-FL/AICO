import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { SYSTEM_PROMPT } from '../constants/systemPromptConstants'
import { AIService, AIVoice, Language, VoiceLanguage } from '../constants/settings'

interface APIKeys {
  openAiKey: string
  anthropicKey: string
  difyKey: string
  difyKeyNormal: string
  elevenlabsApiKey: string
}

interface ModelProvider {
  selectAIService: AIService
  selectAIModel: string
  selectVoice: AIVoice
  stylebertvits2ServerUrl: string
  stylebertvits2ModelId: string
  stylebertvits2Style: string
  elevenlabsVoiceId: string
  openAiTtsVoice: string
}

interface Integrations {
  difyUrl: string
  difyConversationId: string
}

interface Character {
  characterName: string
  showCharacterName: boolean
  systemPrompt: string
  conversationContinuityMode: boolean
}

interface General {
  selectLanguage: Language | 'auto'
  isAutoLanguageDetection: boolean
  selectVoiceLanguage: VoiceLanguage
  changeEnglishToJapanese: boolean
  detectedLanguage: string
}

export type SettingsState = APIKeys & ModelProvider & Integrations & Character & General

const config = window.api.getConfig()
const openAiKey = config.General.OpenAI_API_Key
const difyKey = config.General.Dify_API_Key
const difyUrl = config.General.Dify_API_URL

// セッションストレージアダプター
const sessionStorageAdapter = {
  getItem: (name: string) => {
    const str = sessionStorage.getItem(name)
    if (!str) return null
    return JSON.parse(str)
  },
  setItem: (name: string, value: any) => {
    sessionStorage.setItem(name, JSON.stringify(value))
  },
  removeItem: (name: string) => {
    sessionStorage.removeItem(name)
  }
}

const settingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // API Keys
      openAiKey: openAiKey,
      anthropicKey: '',
      difyKey: difyKey,
      difyKeyNormal: '',
      elevenlabsApiKey: '',

      // Model Provider
      selectAIService: 'dify',
      selectAIModel: 'gpt-4o',
      openAiTtsVoice: 'nova',
      selectVoice: 'stylebertvits2',
      stylebertvits2ServerUrl: '',
      stylebertvits2ModelId: '0',
      stylebertvits2Style: 'Neutral',
      elevenlabsVoiceId: '',

      // Integrations
      difyUrl: difyUrl,
      difyConversationId: '',

      // Character
      characterName: 'AICO',
      showCharacterName: true,
      systemPrompt: SYSTEM_PROMPT,
      conversationContinuityMode: false,

      // General
      selectLanguage: 'ja',
      isAutoLanguageDetection: false,
      selectVoiceLanguage: 'ja-JP', // TODO: 要整理, ja-JP, en-US
      changeEnglishToJapanese: false,
      detectedLanguage: 'japanese'
    }),
    {
      name: 'settings',
      storage: sessionStorageAdapter
    }
  )
)
// 認識した音声を更新する関数を追加
export const setDetectedLanguage = (language: string) =>
  settingsStore.setState({ detectedLanguage: language })

export default settingsStore
