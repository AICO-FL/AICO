import { useState, useEffect } from 'react'

interface LogoRotatorProps {
  maxHeight: number
  maxWidth: string
}

export const LogoRotator: React.FC<LogoRotatorProps> = ({ maxHeight, maxWidth }) => {
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [logos, setLogos] = useState<string[]>([])

  useEffect(() => {
    // 起動時にロゴファイルを読み込む
    const logoFiles = window.api.getLogoFiles()
    setLogos(logoFiles)
  }, [])

  useEffect(() => {
    if (logos.length === 0) return

    const interval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setCurrentLogoIndex((prevIndex) => (prevIndex + 1) % logos.length)
        setIsVisible(true)
      }, 1500)
    }, 7000)

    return () => clearInterval(interval)
  }, [logos])

  if (logos.length === 0) return null

  return (
    <div
      style={{
        width: maxWidth,
        height: `${maxHeight}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      <img
        src={logos[currentLogoIndex]}
        alt="Logo"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transition: 'opacity 0.7s ease-in-out',
          opacity: isVisible ? 1 : 0
        }}
      />
    </div>
  )
}

export default LogoRotator
