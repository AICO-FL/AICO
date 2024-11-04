import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readFile } from 'node:fs/promises'
import { parse } from 'ini'
import log from 'electron-log'

// ログの設定
log.initialize({ preload: true })

// ファイルへのログ出力設定
log.transports.file.level = 'info'
log.transports.file.maxSize = 1024 * 1024 * 10 // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

// コンソールへのログ出力設定（開発時のみ）
if (is.dev) {
  log.transports.console.level = 'info'
  log.transports.console.format = '[{level}] {text}'
}

// アプリケーションの再起動関数をファイルのトップレベルに配置
function relaunchApp(): void {
  log.info('アプリケーションを再起動します')
  app.relaunch()
  app.exit(0)
}

// INIファイルを読み込む処理をasync関数として分離
async function loadConfig() {
  try {
    const configData = await readFile('./config.ini', 'utf-8')
    const parsedConfig = parse(configData)
    log.info('設定ファイルを読み込みました')
    return parsedConfig
  } catch (error) {
    log.error('設定ファイルの読み込みに失敗:', error)
    return {}
  }
}

async function createWindow(): Promise<void> {
  const config = await loadConfig()
  // processオブジェクトを使用して設定を保存
  process.env.CONFIG = JSON.stringify(config)

   // 開発時と本番時の共通設定
   const commonOptions = {
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      experimentalFeatures: true,
      additionalArguments: ['--enable-unsafe-webgpu'],
      contextIsolation: true,
      nodeIntegration: false
    }
  }

  // 環境に応じた設定
  const environmentOptions = is.dev
    ? {
        width: 1920,
        height: 1080,
        useContentSize: true,
        frame: true,
        show: false,
        autoHideMenuBar: false, // 開発時はメニューバーを表示
        resizable: true,
        maximizable: true,
        minimizable: true,
        closable: true,
        kiosk: false
      }
    : {
        width: 1920,
        height: 1080,
        useContentSize: false,
        frame: true,
        show: false,
        autoHideMenuBar: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        closable: false,
        alwaysOnTop: true,
        disableAutoHideCursor: true,
        kiosk: true
      }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...commonOptions,
    ...environmentOptions
  })

  // 開発者ツールを開発時のみ自動的に開く
  mainWindow.webContents.openDevTools()
  if (is.dev) {
    mainWindow.webContents.openDevTools()
    log.info('開発者ツールを開きました')
  }

  // メモリ使用状況の監視を開始
  const memoryMonitorInterval = setInterval(async () => {
    try {
      const processMemory = process.memoryUsage()
      
      log.info('メモリ使用状況:', {
        process: {
          rss: `${Math.round(processMemory.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(processMemory.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(processMemory.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(processMemory.external / 1024 / 1024)}MB`,
        },
        // CPUの使用率を追加
        cpu: process.getCPUUsage(),
        // システムメモリ情報
        systemMemory: {
          total: `${Math.round(process.getSystemMemoryInfo().total / 1024)}MB`,
          free: `${Math.round(process.getSystemMemoryInfo().free / 1024)}MB`,
        }
      })
    } catch (error) {
      log.error('メモリ使用状況の取得に失敗:', error)
    }
  }, 300000) // 5分ごとに記録

  // ウィンドウが閉じられたときにメモリ監視を停止
  mainWindow.on('closed', () => {
    clearInterval(memoryMonitorInterval)
    log.info('メモリ監視を停止しました')
  })

  // メディアの自動許可
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      log.info('メディアアクセスを許可しました')
      
      // メディア開始時のイベント
      webContents.on('media-started-playing', () => {
        log.info('メディアストリームが開始されました')
      })
      
      // ページ読み込み失敗時のイベント
      webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        log.error('ページ読み込みエラー:', {
          code: errorCode,
          description: errorDescription
        })
        
        // エラーから回復を試みる
        setTimeout(() => {
          webContents.reload()
        }, 1000) // 1秒後に再読み込み
      })
  
      // クラッシュ検知
      webContents.on('render-process-gone', (event, details) => {
        log.error('レンダラープロセスがクラッシュ:', details)
        webContents.reload()
      })
    } else {
      callback(false)
      log.info(`メディアアクセスを拒否しました: ${permission}`)
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // レンダラープロセスのクラッシュ検知を mainWindow.webContents に対して設定
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log.error('レンダラープロセスがクラッシュ:', details)
    if (details.reason === 'crashed' || details.reason === 'killed') {
      log.error(`レンダラープロセスが${details.reason}により終了`)
      relaunchApp()
    }
  })
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

  // 子プロセスのクラッシュ検知
  app.on('child-process-gone', (event, details) => {
    log.error('子プロセスが予期せず終了:', {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode
    })

    // プラグインやGPUプロセスなど、重要な子プロセスがクラッシュした場合はアプリを再起動
    if (details.type === 'GPU' || details.type === 'Pepper Plugin') {
      log.info('重要な子プロセスがクラッシュしたため、アプリケーションを再起動します')
      relaunchApp()
    } else {
      // その他の子プロセスの場合は、必要に応じてメインウィンドウをリロード
      const windows = BrowserWindow.getAllWindows()
      windows.forEach(window => window.webContents.reload())
    }
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
    log.info('最終メモリ使用状況:', {
      ...process.memoryUsage(),
      timestamp: new Date().toISOString()
    })
    log.info('アプリケーションを終了します')
    app.quit()
  }
})

// エラーハンドリング
process.on('uncaughtException', (error) => {
  log.error('electron:event:uncaughtException');
  log.error(error);
  log.error(error.stack);
})

process.on('unhandledRejection', (reason) => {
  log.error('未処理のPromise rejectionが発生しました:')
  log.error(reason);
})
