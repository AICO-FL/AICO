import { contextBridge } from 'electron'
import { join } from 'path'
//import path from 'path'
import { readFileSync, readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronAPI } from '@electron-toolkit/preload'

// 型定義の追加
declare global {
  namespace NodeJS {
    interface Global {
      sharedConfig: Record<string, any>
    }
  }
}

// 環境に応じたパスを設定する関数
function getResourcePath() {
  if (process.env.NODE_ENV === 'development') {
    // 開発環境の場合、プロジェクトルートからの相対パスを使用
    return join(__dirname, '../../src/renderer/assets')
  } else {
    // 本番環境の場合、process.resourcesPathを使用
    return process.resourcesPath
  }
}

// リソースパスを取得
const resourcePath = getResourcePath()
console.log('リソースパス', resourcePath)

// 絶対パスを取得
const yoloModelPath = join(
  resourcePath,
  'models/yolov9/yolov9_s_wholebody25_post_0100_1x3x480x640.onnx'
)
const wasmPath = join(resourcePath, 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm')
const vrmPath = join(resourcePath, 'vrms/models/stuff/akiuv2.vrm')
const vrmAnimationPath = join(resourcePath, 'vrms/animations/idle_loop.vrma')
const silerovadOnnxPath = join(resourcePath, 'models/silero_onnx/silero_vad.onnx')

const backgroundImagePath = join(resourcePath, 'media/images/wallpaper/akiu_background.jpg')

// Custom APIs for renderer
const api = {
  // INIファイルの設定を取得するメソッドを追加
  getConfig: () => {
    try {
      // process.envから設定を取得
      const configStr = process.env.CONFIG

      if (!configStr) {
        return { General: { Key: '' } }
      }

      const config = JSON.parse(configStr)
      return config
    } catch (error) {
      console.error('設定の取得に失敗:', error)
      return { General: { Key: '' } }
    }
  },
  // 特定のセクションの設定を取得
  getConfigSection: (section: string) => {
    try {
      const configStr = process.env.CONFIG
      if (!configStr) {
        return {}
      }

      const config = JSON.parse(configStr)
      return config[section] || {}
    } catch (error) {
      console.error(`設定セクション ${section} の取得に失敗:`, error)
      return {}
    }
  },

  getYoloModelPath: () => {
    try {
      return yoloModelPath
    } catch (error) {
      console.error('モデルファイルの読み込みに失敗しました:', error)
      return null
    }
  },
  getWasmData: () => {
    try {
      const wasmData = readFileSync(wasmPath)
      return wasmData
    } catch (error) {
      console.error('wasmファイルの読み込みに失敗しました:', error)
      return null
    }
  },
  getVrmData: () => {
    try {
      const vrmData = readFileSync(vrmPath)
      return vrmData
    } catch (error) {
      console.error('vrmファイルの読み込みに失敗しました:', error)
      return null
    }
  },
  getVrmAnimationData: () => {
    try {
      const vrmAnimationData = readFileSync(vrmAnimationPath)
      return vrmAnimationData
    } catch (error) {
      console.error('vrmアニメーションファイルの読み込みに失敗しました:', error)
      return null
    }
  },

  getBackgroundImagePath: () => {
    try {
      return pathToFileURL(backgroundImagePath).href
    } catch (error) {
      console.error('背景画像の読み込みに失敗しました:', error)
      return null
    }
  },
  getLogoFiles: () => {
    try {
      const logoPath = join(resourcePath, 'media/images/logo')
      const files = readdirSync(logoPath)
        .filter((file) => /\.(png|jpg|jpeg|gif)$/i.test(file))
        .map((file) => pathToFileURL(join(logoPath, file)).href)
      return files
    } catch (error) {
      console.error('ロゴファイルの読み込みに失敗しました:', error)
      return []
    }
  },

  getSilerovadOnnxPath: () => {
    try {
      return silerovadOnnxPath
    } catch (error) {
      console.error('VADモデルファイルの読み込みに失敗しました:', error)
      return null
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('sharedConfig', global.sharedConfig)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore
  window.sharedConfig = global.sharedConfig
}
