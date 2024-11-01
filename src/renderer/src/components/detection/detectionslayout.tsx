import { FC } from 'react'
import Yolov9 from './yolov9'
import FaceMesh from './facemesh'

const DetectionLayout: FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        width: '30%',
        height: '15%',
        top: '7%',
        gap: '5px',
        alignItems: 'flex-start',
        margin: 0
      }}
    >
      {/* Yolov9 */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          aspectRatio: '16/9', // アスペクト比を維持
          margin: 0, // 追加: 子要素の余白も消す
          padding: 0 // 追加: 子要素のパディングも消す
        }}
      >
        <Yolov9 />
      </div>

      {/* FaceMesh */}
      <div
        style={{
          display: 'none',
          flex: 1,
          overflow: 'hidden',
          aspectRatio: '16/9'
        }}
      >
        <FaceMesh />
      </div>
    </div>
  )
}

export default DetectionLayout
