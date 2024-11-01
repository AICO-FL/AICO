import React, { useState, useEffect } from 'react'

const DateTimeDisplay: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const timeZone = 'Asia/Tokyo'

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timeZone
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timeZone
    })
  }

  if (!currentTime) {
    return null
  }

  return (
    <div style={{ textAlign: 'center', fontSize: '18px', color: '#ffffff' }}>
      <div>{formatDate(currentTime)}</div>
      <div>{formatTime(currentTime)}</div>
    </div>
  )
}

export default DateTimeDisplay
