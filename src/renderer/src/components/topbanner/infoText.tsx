import React, { useState, useEffect, useRef } from 'react'

const SampleText: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [position, setPosition] = useState(0)
  const [stage, setStage] = useState<'entering' | 'paused' | 'exiting' | 'waiting'>('waiting')
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const sampleTexts = ['いらっしゃいませ、ファーストゲーミングへようこそ。']

  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const calculatePositions = () => {
      const containerWidth = container.offsetWidth
      const textWidth = text.offsetWidth
      const startPosition = containerWidth
      const endPosition = -textWidth
      return { startPosition, endPosition }
    }

    // テキストの幅をぴったりにするために、textRefの幅を取得して設定
    text.style.width = `${text.scrollWidth}px`

    let { startPosition, endPosition } = calculatePositions()

    const updatePosition = () => {
      switch (stage) {
        case 'entering':
          setPosition((prev) => {
            const newPosition = prev - 4.0
            if (newPosition <= 0) {
              setStage('paused')
              setTimeout(() => setStage('exiting'), 5000)
              return 0
            }
            return newPosition
          })
          break
        case 'exiting':
          setPosition((prev) => {
            const newPosition = prev - 4.0
            if (newPosition <= endPosition) {
              setStage('waiting')
              setCurrentTextIndex((prevIndex) => (prevIndex + 1) % sampleTexts.length)
              return startPosition
            }
            return newPosition
          })
          break
        case 'waiting':
          ;({ startPosition, endPosition } = calculatePositions())
          setPosition(startPosition)
          setTimeout(() => {
            setStage('entering')
          }, 50)
          break
      }
    }

    const slideInterval = setInterval(updatePosition, 20)

    return () => {
      clearInterval(slideInterval)
    }
  }, [stage, sampleTexts.length])

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
      <div
        ref={textRef}
        style={{
          color: '#ffffff',
          fontSize: '30px',
          transform: `translateX(${position}px)`,
          transition: stage === 'waiting' ? 'none' : 'transform 0.02s linear',
          display: 'inline-block',
          width: 'auto'
        }}
      >
        {sampleTexts[currentTextIndex]}
      </div>
    </div>
  )
}

export default SampleText
