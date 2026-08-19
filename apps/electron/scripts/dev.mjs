/**
 * Electron development runner.
 *
 * The web host executes directly from the workspace through `tsx`; every
 * client plugin is rebuilt by the existing HMR watcher. Changes to Electron's
 * main-process source restart Electron, while client source changes travel
 * through Harness's browser HMR channel without closing the window.
 */
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const electronDirectory = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(electronDirectory, '..', '..')
const electronBinary = join(electronDirectory, 'node_modules', '.bin', 'electron')
const ignoredSegments = new Set(['.git', 'dist', 'lib', 'node_modules'])
let electron
let rebuildingShell = false
let restartTimer
let stopping = false

function run(command, args, options = {}) {
  return spawn(command, args, { cwd: repositoryRoot, stdio: 'inherit', ...options })
}

function onceExit(child, name) {
  return new Promise((resolvePromise, reject) => {
    child.once('error', reject)
    child.once('exit', code => code === 0
      ? resolvePromise()
      : reject(new Error(`${name} exited with status ${code ?? 'unknown'}`)))
  })
}

function startElectron() {
  // ELECTRON_RUN_AS_NODE would make the Electron binary run as plain Node (the
  // dev runner may itself be launched through a Node wrapper that sets it),
  // so strip it from the child environment to guarantee a real Electron window.
  const env = { ...process.env, DSH_ELECTRON_DEV: '1' }
  delete env.ELECTRON_RUN_AS_NODE
  electron = spawn(electronBinary, ['app'], {
    cwd: electronDirectory,
    stdio: 'inherit',
    env,
  })
  electron.once('exit', code => {
    electron = undefined
    if (!stopping && code !== 0) console.error(`electron exited with status ${code ?? 'unknown'}`)
  })
}

function restartElectron() {
  if (stopping) return
  if (electron === undefined) {
    startElectron()
    return
  }
  electron.once('exit', () => {
    if (!stopping) startElectron()
  })
  electron.kill()
}

function isIgnored(path) {
  return relative(repositoryRoot, path).split(sep).some(segment => ignoredSegments.has(segment))
}

function shouldRestart(path) {
  if (isIgnored(path)) return false
  const relativePath = relative(repositoryRoot, path).split(sep).join('/')
  // Client plugins rebuild and refresh through the HMR receiver. Restarting
  // Electron for those would throw away the exact UI state a developer is
  // trying to inspect.
  if (relativePath.startsWith('packages/client/')) return false
  // A shell source change needs a fresh Vite build before Electron reloads it.
  if (relativePath.startsWith('apps/web/')) return true
  return relativePath.startsWith('apps/electron/app/')
    || relativePath.startsWith('apps/cli/src/')
    || relativePath.startsWith('packages/api/')
    || relativePath.startsWith('packages/host/')
    || relativePath.startsWith('packages/llm/')
    || relativePath.startsWith('packages/bundle/')
    || relativePath.startsWith('packages/settings/')
}

function scheduleRestart(path) {
  if (!shouldRestart(path)) return
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    const relativePath = relative(repositoryRoot, path).split(sep).join('/')
    if (relativePath.startsWith('apps/web/')) {
      if (rebuildingShell) return
      rebuildingShell = true
      const build = run('pnpm', ['run', 'build:web'])
      void onceExit(build, 'build:web').then(restartElectron).catch(error => {
        console.error(error)
      }).finally(() => { rebuildingShell = false })
      return
    }
    restartElectron()
  }, 150)
}

async function main() {
  // The web shell is an emitted Vite artifact; client plugins are separately
  // watched below and injected through Harness's HMR receiver.
  await onceExit(run('pnpm', ['run', 'build:web']), 'build:web')

  const watcher = run('pnpm', ['run', 'dev:web'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let watcherReady = false
  const forward = chunk => {
    process.stdout.write(chunk)
    if (!watcherReady && String(chunk).includes('dev-web: watching')) {
      watcherReady = true
      startElectron()
    }
  }
  watcher.stdout.setEncoding('utf8')
  watcher.stderr.setEncoding('utf8')
  watcher.stdout.on('data', forward)
  watcher.stderr.on('data', chunk => process.stderr.write(chunk))
  watcher.once('exit', code => {
    if (!stopping) {
      console.error(`dev:web exited with status ${code ?? 'unknown'}`)
      process.exitCode = 1
      stop()
    }
  })

  // macOS supports recursive FSEvents. The runner is macOS-only just like
  // Electron packaging, so this deliberately avoids another watcher runtime.
  const sourceWatcher = watch(repositoryRoot, { recursive: true }, (_event, file) => {
    if (file !== null) scheduleRestart(join(repositoryRoot, file))
  })

  const stop = () => {
    if (stopping) return
    stopping = true
    sourceWatcher.close()
    clearTimeout(restartTimer)
    if (electron !== undefined && !electron.killed) electron.kill()
    if (!watcher.killed) watcher.kill()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
