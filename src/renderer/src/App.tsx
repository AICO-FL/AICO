import { useEffect } from 'react'
import './lib/i18n'

import TopBanner from './components/topbanner/topBanner'
import DetectionLayout from './components/detection/detectionslayout'
import VrmViewer from './components/vrmViewer'
import { ChatLog } from './components/chatLog'
import { Form } from './components/form'
import { LevaControls } from './components/LevaControls'
import LanguageSelector from './components/setLanguage'
//import MessageMediaViewer from './components/messageMediaViewer'

import { useDetectionEffect } from './features/detection/useDetectionEffect'

function App(): JSX.Element {
  // DetectionEffectを実行
  useDetectionEffect()

  useEffect(() => {
    const appBackground = document.querySelector('.app-background') as HTMLElement
    if (appBackground) {
      appBackground.style.backgroundImage = `url(${window.api.getBackgroundImagePath()})`
    }
  }, [])

  return (
    <div className="app-background">
      <TopBanner />
      <DetectionLayout />
      <VrmViewer />
      <ChatLog />
      <Form />
      <LevaControls />
      <LanguageSelector />
      {/* <MessageMediaViewer /> */}
    </div>
  )
}

export default App
