import { spawn } from 'node:child_process'
import { cp, lstat, mkdir, readdir, realpath, rm, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const electronDirectory = resolve(import.meta.dirname, '..')
const stagingDirectory = join(electronDirectory, 'dist', 'harness')

await rm(stagingDirectory, { recursive: true, force: true })
await mkdir(dirname(stagingDirectory), { recursive: true })
await run('pnpm', [
  // The Electron package depends on both the CLI and the project's maintained
  // dependency-only runtime manifest. Together they include the CLI's direct
  // dependencies and its dynamically-loaded plugins.
  '--filter', 'deepseek-harness-desktop-electron', 'deploy', '--legacy', '--prod',
  '--config.node-linker=hoisted', '--config.auto-install-peers=false',
  '--config.link-workspace-packages=true', stagingDirectory,
])
// pnpm deploy does not materialize workspace packages supplied through the
// root `link:` overrides. They are runtime dependencies of Cordis, so place
// their already-built production files in the portable closure explicitly.
for (const packageName of ['cosmokit', 'schemastery']) {
  const destination = join(stagingDirectory, 'node_modules', '@deepseek-ai', packageName)
  await rm(destination, { recursive: true, force: true })
  await cp(
    join(repositoryRoot, 'vendor', packageName),
    destination,
    { recursive: true, dereference: true },
  )
}
await materializeLinks(stagingDirectory)
await prunePlatformBinaries(stagingDirectory)

async function run(command, arguments_) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, { cwd: repositoryRoot, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', code => code === 0
      ? resolvePromise()
      : reject(new Error(`${command} exited with status ${code ?? 'unknown'}`)))
  })
}

async function materializeLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) {
      const target = await realpath(path)
      await unlink(path)
      await cp(target, path, { recursive: true, dereference: true })
      if ((await lstat(path)).isDirectory()) await materializeLinks(path)
      continue
    }
    if (metadata.isDirectory()) await materializeLinks(path)
  }
}

async function prunePlatformBinaries(directory) {
  // node-pty ships native binaries for every supported operating system. A
  // Universal macOS release needs both Darwin slices, but never the Windows
  // and Linux ones. Keeping only these two directories cuts the shipped
  // runtime materially without changing either macOS architecture's loader.
  const prebuilds = join(directory, 'node_modules', 'node-pty', 'prebuilds')
  for (const entry of await readdir(prebuilds, { withFileTypes: true })) {
    if (entry.name === 'darwin-x64' || entry.name === 'darwin-arm64') continue
    await rm(join(prebuilds, entry.name), { recursive: true, force: true })
  }
}
