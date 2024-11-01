import React, { useState, useEffect } from 'react'
import homeStore from '../features/stores/home'

interface MediaState {
  url: string | null
  type: 'image' | 'video' | 'pdf' | null
}

const MessageMediaViewer: React.FC = () => {
  const mediaUrl = homeStore((state) => state.mediaUrl)
  const [media, setMedia] = useState<MediaState>({ url: null, type: null })

  useEffect(() => {
    if (mediaUrl) {
      const extension = mediaUrl.split('.').pop()?.toLowerCase()
      if (['png', 'jpeg', 'jpg', 'webp'].includes(extension || '')) {
        setMedia({ url: mediaUrl, type: 'image' })
      } else if (extension === 'mp4') {
        setMedia({ url: mediaUrl, type: 'video' })
      } else if (extension === 'pdf') {
        setMedia({ url: mediaUrl, type: 'pdf' })
      } else {
        setMedia({ url: null, type: null })
      }
    } else {
      setMedia({ url: null, type: null })
    }
  }, [mediaUrl])

  if (!media.url) return null

  return (
    <div className="fixed top-0 right-0 w-[50%] flex overflow-auto">
      {media.type === 'image' && (
        <img
          src={media.url}
          alt="Message media"
          className="max-w-full max-h-full object-contain"
          style={{ width: '70%', height: 'auto', marginLeft: 'auto' }}
        />
      )}
      {media.type === 'video' && (
        <video
          src={media.url}
          controls
          autoPlay
          loop
          muted
          playsInline
          className="max-w-full max-h-full"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  )
}

export default MessageMediaViewer
