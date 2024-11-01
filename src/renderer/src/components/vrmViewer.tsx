import { useCallback } from 'react'
import homeStore from '../features/stores/home'

export default function VrmViewer() {
  const canvasRef = useCallback((canvas: HTMLCanvasElement) => {
    if (canvas) {
      const { viewer } = homeStore.getState()
      viewer.setup(canvas)
      viewer.loadVrm(window.api.getVrmData())
    }
  }, [])

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '100vw', zIndex: 3 }}>
      <canvas ref={canvasRef} style={{ height: screen.height, width: screen.width }}></canvas>
    </div>
  )
}
