import { useControls, folder } from 'leva'
import settingsStore from '../../stores/settings'

export const ElevenLabsControls: React.FC<{ store: any; parentFolder: string }> = ({
  store,
  parentFolder
}) => {
  useControls(
    {
      [parentFolder]: folder({
        'API キー': {
          value: settingsStore.getState().elevenlabsApiKey,
          onChange: (value) => settingsStore.setState({ elevenlabsApiKey: value })
        },
        ボイスID: {
          value: settingsStore.getState().elevenlabsVoiceId,
          onChange: (value) => settingsStore.setState({ elevenlabsVoiceId: value })
        }
      })
    },
    { store }
  )

  return null
}
