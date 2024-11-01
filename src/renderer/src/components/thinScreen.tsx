import React, { useState, useEffect } from 'react'

type Props = {
  isVisible: boolean
}

export const ThinScreen: React.FC<Props> = ({ isVisible }) => {
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length < 3 ? prev + '.' : ''))
      }, 500)
      return () => clearInterval(interval)
    }
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '10%',
        width: '50%',
        backgroundColor: 'white',
        borderRadius: '50px',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        zIndex: 40
      }}
    >
      <div
        style={{
          padding: '0.5rem 0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        {/* 左の円 */}
        <div
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: '3px solid #777777',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="i-material-symbols-sound-sensing"
            style={{
              width: '40px',
              height: '40px',
              color: '#777777'
            }}
          />
        </div>

        {/* 中央テキスト */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'black' }}>
            聞き取っています<span style={{ display: 'inline-block', width: '3ch' }}>{dots}</span>
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'black' }}>
            Listening<span style={{ display: 'inline-block', width: '3ch' }}>{dots}</span>
          </p>
        </div>

        {/* 右の円 (左の円と同じスタイル) */}
        {/*
        <div
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: '3px solid #777777',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="i-material-symbols-mic-outline"
            style={{
              width: '40px',
              height: '40px',
              color: '#777777'
            }}
          />
        </div>
        */}
      </div>
    </div>
  )
}
