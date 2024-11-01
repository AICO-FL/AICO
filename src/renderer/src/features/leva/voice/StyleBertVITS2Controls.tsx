import { useControls, folder } from 'leva'
import settingsStore from '../../stores/settings'

export const StyleBertVITS2Controls: React.FC<{ store: any; parentFolder: string }> = ({
  store,
  parentFolder
}) => {
  useControls(
    {
      [parentFolder]: folder({
        サーバーURL: {
          value: settingsStore.getState().stylebertvits2ServerUrl,
          onChange: (value) => settingsStore.setState({ stylebertvits2ServerUrl: value })
        },
        モデルID: {
          value: settingsStore.getState().stylebertvits2ModelId,
          onChange: (value: string) => {
            const intValue = Math.max(0, Math.round(Number(value)))
            settingsStore.setState({ stylebertvits2ModelId: String(intValue) })
          },
          step: 1,
          min: 0
        },
        スタイル: {
          value: settingsStore.getState().stylebertvits2Style,
          onChange: (value) => settingsStore.setState({ stylebertvits2Style: value })
        }
      })
    },
    { store }
  )

  return null
}
