import { create } from 'zustand'

interface MenuState {
  showWebcam: boolean
  showSettingsButton: boolean
  fileInput: HTMLInputElement | null
  bgFileInput: HTMLInputElement | null
}

const menuStore = create<MenuState>(() => ({
  showWebcam: false,
  showSettingsButton: true,
  fileInput: null,
  bgFileInput: null
}))
export default menuStore
