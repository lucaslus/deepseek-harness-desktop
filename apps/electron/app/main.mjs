import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, Menu, dialog } from 'electron'

const readinessPattern = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/
const desktopChromeScript = `
  (() => {
    document.documentElement.style.setProperty('--dsh-sidebar-logo-row-content-offset', '12px');
    const id = 'dsh-electron-titlebar-drag-region';
    if (document.getElementById(id) || !document.body) return;
    const dragRegion = document.createElement('div');
    dragRegion.id = id;
    dragRegion.setAttribute('aria-hidden', 'true');
    dragRegion.style.cssText = [
      'position:fixed', 'inset:0 0 auto 0', 'height:44px',
      'z-index:2147483647', '-webkit-app-region:drag',
    ].join(';');
    document.body.append(dragRegion);
  })();
`
let host
let mainWindow
let hostOutput = ''
let hostReady = false
let quitting = false
let autoUpdater

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

async function getAutoUpdater() {
  if (autoUpdater !== undefined) return autoUpdater
  // electron-updater is CommonJS. Load it after the native window and Harness
  // host are already starting, rather than putting updater initialization on
  // the cold-start path.
  const { default: updater } = await import('electron-updater')
  autoUpdater = updater.autoUpdater
  return autoUpdater
}

async function checkForUpdates() {
  try {
    const updater = await getAutoUpdater()
    await updater.checkForUpdates()
  } catch (error) {
    console.error('Automatic update check failed:', error)
  }
}

async function configureUpdates() {
  if (!app.isPackaged) return
  const updater = await getAutoUpdater()
  updater.autoDownload = false
  updater.on('update-available', async info => {
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: ['Download and Restart', 'Later'], defaultId: 0,
      title: 'Update available', message: `DeepSeek Harness ${info.version} is available.`,
    })
    if (response === 0) void updater.downloadUpdate()
  })
  updater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0,
      title: 'Update ready', message: 'The update has downloaded and is ready to install.',
    })
    if (response === 0) updater.quitAndInstall()
  })
  updater.on('error', error => console.error('Automatic update failed:', error))
  void checkForUpdates()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 900, minHeight: 600,
    title: 'DeepSeek Harness', backgroundColor: '#1b1b1c',
    // Match the native AppKit shell: content fills the transparent title bar,
    // the traffic lights stay native, and no duplicate window title is shown.
    titleBarStyle: 'hiddenInset',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mainWindow.webContents.on('dom-ready', () => {
    void mainWindow?.webContents.executeJavaScript(desktopChromeScript).catch(error => {
      console.error('Could not apply desktop window chrome:', error)
    })
  })
  void mainWindow.loadFile(join(import.meta.dirname, 'splash.html'))
}

app.whenReady().then(() => {
  try {
    createWindow()
    startHost()
    void configureUpdates()
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'DeepSeek Harness',
        submenu: [
          { role: 'about' }, { type: 'separator' },
          { label: 'Check for Updates…', click: () => void checkForUpdates() },
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
