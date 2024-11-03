import React, { useState, useEffect } from 'react'

type Props = {
  isVisible: boolean
  isLoopMode: boolean
  isVadActive: boolean
  isRecording: boolean
  chatProcessing: boolean
  isWaitingForResponse: boolean
  error: string | null
}

export const ThinScreen: React.FC<Props> = ({ 
  isVisible, 
  isLoopMode,
  isVadActive,
  isRecording, 
  chatProcessing,
  isWaitingForResponse,
  error 
}) => {

  if (!isVisible) {
    return null
  }

  const getStatusMessage = () => {
    if (error) return error
    if (chatProcessing) return "AI回答中"
    if (isWaitingForResponse) return "音声を処理しています"
    if (isRecording) return "聞き取っています..."
    if (isVadActive) return "話してください..."
    if (isLoopMode) return "続けて会話してください。終了するにはSボタンを押してください。"
    return "ボタンを押して会話を開始します"
  }
  
  const getStatusMessageEn = () => {
    if (error) return "Error occurred"
    if (chatProcessing) return "AI answering"
    if (isWaitingForResponse) return "Processing audio"
    if (isRecording) return "Listening..."
    if (isVadActive) return "Listening..."
    if (isLoopMode) return "Continue the conversation. Press the S button to end."
    return "Standby"
  }

  const getStatusIcon = () => {
    if (error) return "i-material-symbols-error-outline"
    if (isLoopMode) return "i-material-symbols-adaptive-audio-mic-outline"
    if (isVadActive) return "i-material-symbols-sound-sensing"
    if (isRecording) return "i-material-symbols-sound-sensing"
    if (isWaitingForResponse) return "i-material-symbols-voice-chat-outline"
    if (chatProcessing) return "i-material-symbols-cloud"
    return "i-material-symbols-adaptive-audio-mic-outline"
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '12%',
        width: '60%',
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
        {/* 左の円 - エラー時、AI回答中、ループモード、待機中に表示 */}
        {(error || chatProcessing || isLoopMode || (!isVadActive && !isRecording && !isWaitingForResponse)) && (
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
              className={getStatusIcon()}
              style={{
                width: '40px',
                height: '40px',
                color: error ? '#ff0000' : '#777777'
              }}
            />
          </div>
        )}

        {/* 中央テキスト */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: error ? '#ff0000' : 'black' }}>
            {getStatusMessage()}<span style={{ display: 'inline-block', width: '3ch' }}></span>
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: error ? '#ff0000' : 'black' }}>
            {getStatusMessageEn()}<span style={{ display: 'inline-block', width: '3ch' }}></span>
          </p>
        </div>

        {/* 右の円 - 音声処理中、録音中、VAD有効時に表示 */}
        {(isWaitingForResponse || isRecording || isVadActive) && (
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
        )}
      </div>
    </div>
  )
}
