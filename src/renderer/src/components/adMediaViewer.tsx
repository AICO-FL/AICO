import React, { useState, useEffect, useCallback } from 'react'
import * as ReactDOM from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

type MediaType = 'image' | 'video'

interface MediaItem {
  url: string
  type: MediaType
}

const MediaViewer: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait'>('landscape')
  const [isLoading, setIsLoading] = useState(true)

  const moveToNextMedia = useCallback(() => {
    setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % mediaItems.length)
  }, [mediaItems.length])

  useEffect(() => {
    const getRandomMedia = async () => {
      try {
        const response = await fetch('/api/getMediaFiles')
        const data = await response.json()

        if (data.files && data.files.length > 0) {
          const items: MediaItem[] = data.files.map((file: string) => ({
            url: file,
            type: /\.(jpe?g|png)$/i.test(file) ? 'image' : 'video'
          }))
          setMediaItems(items)
          setCurrentMediaIndex(0)
        }
      } catch (error) {
        console.error('メディアファイルの読み込みに失敗しました:', error)
      }
    }

    getRandomMedia()
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    if (mediaItems.length > 0) {
      const currentMedia = mediaItems[currentMediaIndex]
      setIsLoading(true)

      if (currentMedia.type === 'image') {
        const img = new Image()
        img.onload = () => {
          setIsLoading(false)
          setAspectRatio(img.width > img.height ? 'landscape' : 'portrait')
          timeoutId = setTimeout(moveToNextMedia, 10000)
        }
        img.onerror = () => {
          console.error('画像の読み込みに失敗しました。次のメディアに移動します。')
          moveToNextMedia()
        }
        img.src = currentMedia.url
      } else if (currentMedia.type === 'video') {
        const videoElement = document.querySelector('video')
        if (videoElement) {
          videoElement.onended = moveToNextMedia
          videoElement.onerror = () => {
            console.error('ビデオの再生中にエラーが発生しました。次のメディアに移動します。')
            moveToNextMedia()
          }
          videoElement.onloadedmetadata = () => {
            setIsLoading(false)
            setAspectRatio(
              videoElement.videoWidth > videoElement.videoHeight ? 'landscape' : 'portrait'
            )
          }

          videoElement.play().catch((error) => {
            console.error('ビデオの再生開始に失敗しました:', error)
            moveToNextMedia()
          })
        }
      }
    }

    return () => {
      clearTimeout(timeoutId)
      const videoElement = document.querySelector('video')
      if (videoElement) {
        videoElement.onended = null
        videoElement.onerror = null
        videoElement.onloadedmetadata = null
      }
    }
  }, [mediaItems, currentMediaIndex, moveToNextMedia])

  if (!mediaItems.length) return null

  const currentMedia = mediaItems[currentMediaIndex]

  const renderMedia = () => {
    if (currentMedia.type === 'image') {
      return (
        <motion.img
          key={currentMedia.url}
          src={currentMedia.url}
          alt="画像コンテンツ"
          className={`max-w-full max-h-full object-contain ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      )
    }

    if (currentMedia.type === 'video') {
      return (
        <video
          key={currentMedia.url}
          src={currentMedia.url}
          autoPlay
          muted
          playsInline
          onEnded={moveToNextMedia}
          className={`max-w-full max-h-full object-contain ${aspectRatio === 'portrait' ? 'h-full' : 'w-full'}`}
          onError={(e) => {
            console.error('ビデオの読み込みエラー:', e)
            moveToNextMedia()
          }}
        />
      )
    }

    return null
  }

  const content = (
    <div
      className="fixed inset-0 top-[80px] flex items-center justify-center bg-[#444444]"
      style={{ zIndex: 9998 }}
    >
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">{renderMedia()}</AnimatePresence>
      </div>
    </div>
  )

  return ReactDOM.createPortal(content, document.body)
}

export default MediaViewer
