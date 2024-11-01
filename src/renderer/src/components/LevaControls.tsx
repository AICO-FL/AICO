import { useCreateStore, LevaPanel } from 'leva'
import { useState, useEffect } from 'react'
import { VoiceControls } from '../features/leva/voice/VoiceControls'
import { DebugMessageInput } from '../features/leva/debugmessageinput'

export const LevaControls: React.FC = () => {
  const [showPanel, setShowPanel] = useState(false)
  const store = useCreateStore()

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'p' || event.key === 'P') {
        setShowPanel((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  return (
    <>
      <VoiceControls store={store} />
      <DebugMessageInput store={store} />
      <LevaPanel store={store} hidden={!showPanel} />
    </>
  )
}
