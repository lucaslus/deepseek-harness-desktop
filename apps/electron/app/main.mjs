import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, Menu, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

const readinessPattern = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/
let host
let mainWindow
let hostOutput = ''
let hostReady = false
let quitting = false

function harnessDirectory() {
  return app.isPackaged
    ? join(process.resourcesPath, 'harness')
    : join(import.meta.dirname, '..', 'dist', 'harness')
}

function harnessEntry() {
  return join(harnessDirectory(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

function harnessWorkingDirectory() {
  return join(harnessDirectory(), 'node_modules', '@deepseek-ai', 'dsh')
}

function appendHostOutput(chunk) {
  hostOutput = `${hostOutput}${chunk}`.slice(-8_192)
}

function showHostFailure() {
  const detail = hostOutput.trim() || 'The local DeepSeek Harness host exited before it was ready.'
  void dialog.showMessageBox({
    type: 'error',
    title: 'DeepSeek Harness could not start',
    message: 'The local host exited before it was ready.',
    detail,
  })
}

function startHost() {
  const entry = harnessEntry()
  if (!existsSync(entry)) throw new Error(`Missing packaged Harness runtime: ${entry}`)
  // Harness enables its HMR service in the default web profile.  Electron is
  // also the embedded Node runtime, so pass this Node flag directly to that
  // child process (NODE_OPTIONS deliberately rejects this diagnostic flag).
  host = spawn(process.execPath, ['--expose-internals', entry, 'web', '--port', '0'], {
    cwd: harnessWorkingDirectory(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  host.stdout.setEncoding('utf8')
  host.stderr.setEncoding('utf8')
  host.stdout.on('data', chunk => {
    appendHostOutput(chunk)
    const ready = readinessPattern.exec(hostOutput)
    if (!hostReady && ready?.[1] && mainWindow !== undefined) {
      hostReady = true
      void mainWindow.loadURL(ready[1])
    }
  })
  host.stderr.on('data', appendHostOutput)
  host.once('exit', () => {
    host = undefined
    if (!quitting && !hostReady && mainWindow !== undefined && !mainWindow.isDestroyed()) showHostFailure()
  })
}

function stopHost() {
  if (host !== undefined && !host.killed) host.kill()
  host = undefined
}

function configureUpdates() {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = false
  autoUpdater.on('update-available', async info => {
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: ['Download and Restart', 'Later'], defaultId: 0,
      title: 'Update available', message: `DeepSeek Harness ${info.version} is available.`,
    })
    if (response === 0) void autoUpdater.downloadUpdate()
  })
  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0,
      title: 'Update ready', message: 'The update has downloaded and is ready to install.',
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', error => console.error('Automatic update failed:', error))
  void autoUpdater.checkForUpdates()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 900, minHeight: 600,
    title: 'DeepSeek Harness', backgroundColor: '#171717',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  void mainWindow.loadURL('data:text/html,<body style="background:%23171717;color:white;font:16px -apple-system;padding:32px">Starting DeepSeek Harness…</body>')
}

app.whenReady().then(() => {
  try {
    createWindow()
    startHost()
    configureUpdates()
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'DeepSeek Harness',
        submenu: [
          { role: 'about' }, { type: 'separator' },
          { label: 'Check for Updates…', click: () => void autoUpdater.checkForUpdates() },
          { type: 'separator' }, { role: 'quit' },
        ],
      },
      { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]))
  } catch (error) {
    void dialog.showMessageBox({ type: 'error', title: 'DeepSeek Harness could not start', message: String(error) })
  }
})

app.on('before-quit', () => {
  quitting = true
  stopHost()
})
app.on('window-all-closed', () => app.quit())
