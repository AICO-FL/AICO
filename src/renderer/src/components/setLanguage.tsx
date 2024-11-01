import React, { useEffect } from 'react'
import { useStore } from 'zustand'
import settingsStore from '../features/stores/settings'
import homeStore from '../features/stores/home'
import { Language } from '../features/constants/settings'
import { bindKey } from '../utils/bindKey'

const languages: { value: Language | 'auto'; label: string }[] = [
  { value: 'auto', label: '自動検出' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '繁體中文' }
]

const LanguageSelector: React.FC = () => {
  const selectLanguage = useStore(settingsStore, (state) => state.selectLanguage)

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLanguage = event.target.value as Language | 'auto'
    settingsStore.setState({
      selectLanguage: selectedLanguage,
      isAutoLanguageDetection: selectedLanguage === 'auto'
    })
  }

  useEffect(() => {
    const unbind = bindKey((key: string) => {
      switch (key) {
        case '1':
          settingsStore.setState({
            selectLanguage: 'auto',
            selectVoice: 'openai',
            isAutoLanguageDetection: true,
            difyConversationId: ''
          }),
            homeStore.setState({
              chatLog: []
            })
          break
        case '2':
          settingsStore.setState({
            selectLanguage: 'ja',
            selectVoice: 'stylebertvits2',
            selectVoiceLanguage: 'ja-JP',
            isAutoLanguageDetection: false,
            difyConversationId: ''
          }),
            homeStore.setState({
              chatLog: []
            })
          break
        case '3':
          settingsStore.setState({
            selectLanguage: 'en',
            selectVoice: 'openai',
            selectVoiceLanguage: 'en-US',
            isAutoLanguageDetection: false,
            difyConversationId: ''
          }),
            homeStore.setState({
              chatLog: []
            })
          break
        case '4':
          settingsStore.setState({
            selectLanguage: 'zh',
            selectVoice: 'openai',
            selectVoiceLanguage: 'zh-TW',
            isAutoLanguageDetection: false,
            difyConversationId: ''
          }),
            homeStore.setState({
              chatLog: []
            })
          break
      }
    })

    return () => {
      unbind()
    }
  }, [])

  return (
    <div className="absolute top-[7%] right-4 w-60">
      <select
        value={selectLanguage}
        onChange={handleLanguageChange}
        className="bg-white border border-gray-300 text-gray-900 text-4xl rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-10"
      >
        {languages.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LanguageSelector
