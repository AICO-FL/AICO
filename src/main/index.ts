import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFile } from 'node:fs/promises'
import { parse } from 'ini'

// INIファイルを読み込む処理をasync関数として分離
async function loadConfig() {
  try {
    const configData = await readFile('./config.ini', 'utf-8')
    const parsedConfig = parse(configData)
    return parsedConfig
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗:', error)
    return {}
  }
}

async function createWindow(): Promise<void> {
  const config = await loadConfig()
  // processオブジェクトを使用して設定を保存
  process.env.CONFIG = JSON.stringify(config)

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: false,
    frame: true,
    show: false,
    autoHideMenuBar: false,
    resizable: true,
    maximizable: true,
    //kiosk: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      experimentalFeatures: true, // WebGPUを有効にする
      additionalArguments: ['--enable-unsafe-webgpu'], // WebGPUフラグ
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 開発者ツールを自動的に開く
  mainWindow.webContents.openDevTools()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // メディアの自動許可
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      // カメラやマイクの許可を自動的に与える
      callback(true)
    } else {
      callback(false)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // システムデフォルトのデバイスを使用するように設定
  app.commandLine.appendSwitch('use-system-media-device')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
