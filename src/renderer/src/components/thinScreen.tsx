import React, { useState, useEffect } from 'react'

type Props = {
  isVisible: boolean
  isLoopMode: boolean
  isVadActive: boolean
  isRecording: boolean
  chatProcessing: boolean
  chatProcessingCount: number
  isWaitingForResponse: boolean
  error: string | null
}

export const ThinScreen: React.FC<Props> = ({ 
  isVisible, 
  isLoopMode,
  isVadActive,
  isRecording, 
  chatProcessing,
  chatProcessingCount,
  isWaitingForResponse,
  error 
}) => {

  if (!isVisible) {
    return null
  }

  const getStatusMessage = () => {
    if (error) return error
    // chatProcessingCount が 0 より大きい場合は処理中
    if (chatProcessingCount > 0) return "AI回答中"
    // 音声認識中の状態
    if (isRecording && isVadActive) return "聞き取っています..."
    // VAD有効で録音待機中
    if (isVadActive && !isRecording) return "話してください..."
    if (isWaitingForResponse) return "音声を処理しています"
    if (isLoopMode && !isVadActive) return "音声認識を開始しています..."
    if (isLoopMode) return "続けて会話してください。終了するにはSボタンを押してください。"
    return "ボタンを押して会話を開始します"
  }
  
  const getStatusMessageEn = () => {
    if (error) return error
    // chatProcessingCount が 0 より大きい場合は処理中
    if (chatProcessingCount > 0) return "AI answering"
    // 音声認識中の状態
    if (isRecording && isVadActive) return "Listening..."
    // VAD有効で録音待機中
    if (isVadActive && !isRecording) return "Talk to me..."
    if (isWaitingForResponse) return "Processing audio"
    if (isLoopMode && !isVadActive) return "Starting voice recognition..."
    if (isLoopMode) return "Continue the conversation. Press the S button to end."
    return "Press the button to start the conversation"
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
