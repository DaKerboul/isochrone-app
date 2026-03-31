import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import http from 'node:http'
import { execFile, ChildProcess } from 'node:child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const VALHALLA_URL = 'http://127.0.0.1:8002'
const CONTAINER_NAME = 'valhalla-service'
const WSL_EXE = 'C:\\Windows\\System32\\wsl.exe'

let valhallaProcess: ChildProcess | null = null
let valhallaReady = false
let mainWindowRef: BrowserWindow | null = null

function wsl(...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = execFile(WSL_EXE, ['-d', 'Ubuntu', '--', ...args], (err, stdout, stderr) => {
      const code = typeof err?.code === 'number' ? err.code : 0
      resolve({ stdout: stdout || '', stderr: stderr || '', code })
    })
    child.stdout?.on('data', () => {})
    child.stderr?.on('data', () => {})
  })
}

async function pollValhalla(timeoutMs = 180000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`${VALHALLA_URL}/status`, { timeout: 2000 }, (res) => {
          res.resume()
          if (res.statusCode === 200) resolve()
          else reject(new Error(`HTTP ${res.statusCode}`))
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return false
}

async function startValhalla(): Promise<void> {
  // If already running, just poll and declare ready
  const { stdout: running } = await wsl('docker', 'inspect', '-f', '{{.State.Running}}', CONTAINER_NAME)
  if (running.trim() === 'true') {
    console.log('[Valhalla] Container already running, polling...')
    const ready = await pollValhalla(30000)
    valhallaReady = ready
    mainWindowRef?.webContents.send('valhalla-status', ready ? 'ready' : 'error')
    return
  }

  console.log('[Valhalla] Starting container...')
  // Remove stale container if exists
  await wsl('docker', 'rm', '-f', CONTAINER_NAME)

  const { code } = await new Promise<{ code: number }>((resolve) => {
    const child = execFile(
      WSL_EXE,
      [
        '-d', 'Ubuntu', '--',
        'docker', 'run', '-d',
        '--name', CONTAINER_NAME,
        '--restart=unless-stopped',
        '-p', '8002:8002',
        '-v', '/home/kerboul/valhalla:/custom_files',
        '--entrypoint', '/usr/local/bin/valhalla_service',
        'ghcr.io/gis-ops/docker-valhalla/valhalla:latest',
        '/custom_files/valhalla.json', '4'
      ],
      (err) => resolve({ code: typeof err?.code === 'number' ? err.code : 0 })
    )
    child.stdout?.on('data', (d) => console.log('[Valhalla] docker run:', d.toString().trim()))
    child.stderr?.on('data', (d) => console.error('[Valhalla] docker run err:', d.toString().trim()))
  })

  if (code !== 0) {
    console.error('[Valhalla] Failed to start container')
    mainWindowRef?.webContents.send('valhalla-status', 'error')
    return
  }

  console.log('[Valhalla] Container started, waiting for service...')
  const ready = await pollValhalla(180000)
  valhallaReady = ready
  if (ready) {
    console.log('[Valhalla] Ready ✓')
    mainWindowRef?.webContents.send('valhalla-status', 'ready')
  } else {
    console.error('[Valhalla] Timed out waiting for service')
    mainWindowRef?.webContents.send('valhalla-status', 'error')
  }
}

async function stopValhalla(): Promise<void> {
  if (valhallaProcess) {
    valhallaProcess.kill()
    valhallaProcess = null
  }
  await wsl('docker', 'stop', CONTAINER_NAME).catch(() => {})
  await wsl('docker', 'rm', CONTAINER_NAME).catch(() => {})
  valhallaReady = false
}

// AbortController for in-flight isochrone requests
let currentIsoRequest: ReturnType<typeof http.request> | null = null

ipcMain.handle('valhalla-abort', () => {
  if (currentIsoRequest) {
    currentIsoRequest.destroy()
    currentIsoRequest = null
  }
})

// IPC: isochrone fetch — proxied through Node.js native http (bypasses Chromium)
ipcMain.handle('valhalla-fetch', async (_event, _urlStr: string, body: string) => {
  // Cancel any in-flight request
  if (currentIsoRequest) {
    currentIsoRequest.destroy()
    currentIsoRequest = null
  }
  return new Promise<string>((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8002,
        path: '/isochrone',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          currentIsoRequest = null
          resolve(JSON.stringify({ statusCode: res.statusCode, body: data }))
        })
      }
    )
    currentIsoRequest = req
    req.on('timeout', () => { req.destroy(); currentIsoRequest = null; reject('Connection timeout') })
    req.on('error', (err) => { currentIsoRequest = null; reject(err.message) })
    req.write(body)
    req.end()
  })
})

ipcMain.handle('valhalla-status', () => valhallaReady ? 'ready' : 'starting')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindowRef = mainWindow

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Start Valhalla after window is shown
    startValhalla().catch((e) => console.error('[Valhalla] start error:', e))
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
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests')
// Force Chromium to use DoH, bypassing Tailscale DNS capture
app.commandLine.appendSwitch('dns-over-https-mode', 'secure')
app.commandLine.appendSwitch('dns-over-https-servers', 'https://1.1.1.1/dns-query,https://8.8.8.8/dns-query')

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopValhalla().catch(() => {})
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
