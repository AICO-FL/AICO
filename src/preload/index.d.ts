import { ElectronAPI } from '@electron-toolkit/preload'

export interface Api {
  getConfig: () => Record<string, any>
  getConfigSection: (section: string) => Record<string, any>

  getYoloModelPath: () => string
  getWasmData: () => string
  getVrmData: () => ArrayBuffer
  getVrmAnimationData: () => ArrayBuffer

  getBackgroundImagePath: () => string
  getLogoFiles: () => string[]

  getSilerovadOnnxPath: () => string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api // 'unknown' から 'Api' に変更
  }
}
