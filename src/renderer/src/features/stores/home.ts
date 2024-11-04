import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { Message } from '../messages/messages'
import { Viewer } from '../vrmViewer/viewer'

export interface PersistedState {
  userOnboarded: boolean
  chatLog: Message[]
  codeLog: Message[]
  dontShowIntroduction: boolean
}

export interface TransientState {
  viewer: Viewer
  assistantMessage: string
  isProcessing: boolean; 
  chatProcessing: boolean
  chatProcessingCount: number
  incrementChatProcessingCount: () => void
  decrementChatProcessingCount: () => void
  isSearchingInformation: boolean
  modalImage: string
  triggerShutter: boolean
  webcamStatus: boolean
  mediaUrl: string | null
  setMediaUrl: (url: string | null) => void
}

export type HomeState = PersistedState & TransientState

const homeStore = create<HomeState>()(
  persist(
    (set) => ({
      // persisted states
      dontShowIntroduction: false,

      // transient states
      userOnboarded: false,
      chatLog: [],
      codeLog: [],
      viewer: new Viewer(),
      assistantMessage: '',
      isProcessing: false,
      chatProcessing: false,
      chatProcessingCount: 0,
      incrementChatProcessingCount: () => {
        set(({ chatProcessingCount }) => ({
          chatProcessingCount: chatProcessingCount + 1
        }))
      },
      decrementChatProcessingCount: () => {
        set(({ chatProcessingCount }) => ({
          chatProcessingCount: chatProcessingCount - 1
        }))
      },
      isSearchingInformation: false,
      modalImage: '',
      triggerShutter: false,
      webcamStatus: false,
      mediaUrl: null,
      setMediaUrl: (url) => set({ mediaUrl: url }),
      ws: null,
      voicePlaying: false
    }),
    {
      name: 'home',
      partialize: ({ userOnboarded, dontShowIntroduction }) => ({
        dontShowIntroduction,
        userOnboarded
      })
    }
  )
)
export default homeStore
