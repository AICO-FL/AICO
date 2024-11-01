import { useControls, folder } from 'leva'
import { useState, useEffect } from 'react'
import { AIVoice } from '../../constants/settings'
import settingsStore from '../../stores/settings'
import { StyleBertVITS2Controls } from './StyleBertVITS2Controls'
import { ElevenLabsControls } from './ElevenLabsControls'

function useSettingsStore<T>(selector: (state: ReturnType<typeof settingsStore.getState>) => T): T {
  const [value, setValue] = useState<T>(() => selector(settingsStore.getState()))

  useEffect(() => {
    const unsubscribe = settingsStore.subscribe((state) => {
      const newValue = selector(state)
      if (newValue !== value) {
        setValue(newValue)
      }
    })

    return unsubscribe
  }, [selector, value])

  return value
}

export const VoiceControls: React.FC<{ store: any }> = ({ store }) => {
  const selectedVoice = useSettingsStore((state) => state.selectVoice)

  const controls = useControls(
    {
      音声設定: folder({
        音声エンジン: {
          value: selectedVoice,
          options: {
            StyleBertVITS2: 'stylebertvits2',
            ElevenLabs: 'elevenlabs'
          },
          onChange: (value: AIVoice) => {
            settingsStore.setState({ selectVoice: value })
          }
        },
        // 各エンジンの設定をここにネストする
        ...(selectedVoice === 'stylebertvits2' && { StyleBertVITS2: folder({}) }),
        ...(selectedVoice === 'elevenlabs' && { ElevenLabs: folder({}) })
      })
    },
    { store }
  )

  // 選択された音声エンジンに応じて、対応するコントロールコンポーネントをレンダリング
  return (
    <>
      {selectedVoice === 'stylebertvits2' && (
        <StyleBertVITS2Controls store={store} parentFolder="音声設定.StyleBertVITS2" />
      )}
      {selectedVoice === 'elevenlabs' && (
        <ElevenLabsControls store={store} parentFolder="音声設定.ElevenLabs" />
      )}
    </>
  )
}
