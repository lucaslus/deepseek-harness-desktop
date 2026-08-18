/**
 * Host plugin inventory and installer: a Remote-only service exposing the
 * current Cordis Loader entries plus profile-level plugin install/remove.
 *
 * `list()` is the read-only projection. `install()`/`remove()` manage the
 * *profile composition* (`$DSH_HOME/profiles/<profile>/package.json` bundles +
 * dependencies and the `node_modules` symlink) so a user without a local `dsh`
 * CLI or pnpm can still install a plugin from the Settings UI. The Loader
 * resolves the package through the profile's `node_modules`, so a restart
 * loads the new composition; the operation itself never touches a live Loader
 * entry.
 */

import type { Context, FiberState } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join, resolve } from 'node:path'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  PluginEntryId,
  PluginFiberPhase,
  PluginInventoryEntry,
  PluginInventorySnapshot,
  PluginManagerResult,
} from './types.ts'

export type * from './types.ts'

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

const execFileAsync = promisify(execFile)

/** The profile the running GUI targets; overridable for other surfaces. */
function activeProfile(): string {
  return process.env.DSH_PROFILE ?? 'web'
}

/** Absolute profile directory (`$DSH_HOME/profiles/<profile>`). */
function profileDir(): string {
  return dshHomePath('profiles', activeProfile())
}

/** Parse a GitHub source spec into its `owner/repo` slug. */
function gitSlugOf(source: string): string | undefined {
  const trimmed = source.trim()
  const github = trimmed.match(/^(?:github:|https?:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)
  return github === null ? undefined : github[1]
}

/** Serialize profile mutations: one install/remove at a time. */
let mutationChain: Promise<unknown> = Promise.resolve()
function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(operation, operation)
  mutationChain = next.catch(() => undefined)
  return next
}

/** Remote-only service exposing the Loader's current non-group entry state. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  constructor(ctx: Context) {
    super(ctx, 'pluginInventory')
  }

  /**
   * Read the Loader directly on every call. Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   * @returns Current non-group Loader entries in Loader order.
   */
  @Remote('list')
  list(): PluginInventorySnapshot {
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      entries.push({
        entryId: pluginEntryId(entry.id),
        moduleName: entry.options.name,
        enabled: !entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      })
    }
    return { entries }
  }

  /**
   * Install a plugin bundle into the active profile from a local directory or
   * a GitHub source (`github:owner/repo`, `https://github.com/owner/repo`,
   * `git@github.com:owner/repo.git`). A restart loads the new composition.
   * @param request - the plugin source spec.
   * @returns the package name and restart requirement, or a failure code.
   */
  @Remote('install')
  install(request: { source: string }): Promise<PluginManagerResult> {
    return enqueueMutation(() => this.installNow(request.source))
  }

  /**
   * Remove a plugin bundle from the active profile by package name. A restart
   * drops the composition row; the Loader never mutates live entries here.
   * @param request - the installed package name.
   * @returns the removed name or a failure code.
   */
  @Remote('remove')
  remove(request: { name: string }): Promise<PluginManagerResult> {
    return enqueueMutation(() => this.removeNow(request.name))
  }

  private async installNow(source: string): Promise<PluginManagerResult> {
    const dir = profileDir()
    try {
      const pluginDir = await this.materializeSource(source, dir)
      const pkgPath = join(pluginDir, 'package.json')
      if (!existsSync(pkgPath)) {
        return { ok: false, error: 'missing-manifest', message: `no package.json under ${pluginDir}` }
      }
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
        name?: unknown
        dsh?: { bundle?: unknown }
      }
      if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
        return { ok: false, error: 'missing-manifest', message: 'package.json declares no name' }
      }
      if (pkg.dsh?.bundle === undefined) {
        return {
          ok: false,
          error: 'not-a-bundle',
          message: `${pkg.name} declares no dsh.bundle manifest — only installable plugin bundles are supported`,
        }
      }
      await this.addToProfile(dir, pkg.name, pluginDir)
      return { ok: true, name: pkg.name, restartRequired: true }
    } catch (error) {
      return {
        ok: false,
        error: 'install-failed',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async removeNow(name: string): Promise<PluginManagerResult> {
    const dir = profileDir()
    try {
      await this.removeFromProfile(dir, name)
      return { ok: true, name, restartRequired: true }
    } catch (error) {
      return {
        ok: false,
        error: 'remove-failed',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /** Resolve a local path or download+extract a GitHub tarball into the plugin source cache. */
  private async materializeSource(source: string, dir: string): Promise<string> {
    const slug = gitSlugOf(source)
    if (slug !== undefined) {
      const cacheRoot = join(dir, '.plugin-sources')
      const target = join(cacheRoot, slug.replace('/', '-'))
      if (existsSync(join(target, 'package.json'))) return target
      await mkdir(cacheRoot, { recursive: true })
      const tarball = `${target}.tar.gz`
      await execFileAsync('curl', ['-fsSL', '-o', tarball, `https://codeload.github.com/${slug}/tar.gz/HEAD`])
      await rm(target, { recursive: true, force: true })
      await mkdir(target, { recursive: true })
      await execFileAsync('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'])
      await rm(tarball, { force: true })
      return target
    }
    const local = resolve(source)
    if (!existsSync(local)) {
      throw new Error(`source does not exist: ${source}`)
    }
    return local
  }

  /** Add a bundle to the profile composition: dependencies link + bundles row + node_modules symlink. */
  private async addToProfile(dir: string, name: string, pluginDir: string): Promise<void> {
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { profile?: { bundles?: string[] } }
    }
    await writeFile(`${manifestPath}.bak`, JSON.stringify(manifest, null, 2) + '\n')
    manifest.dependencies ??= {}
    manifest.dependencies[name] = `link:${pluginDir}`
    manifest.dsh ??= {}
    manifest.dsh.profile ??= {}
    manifest.dsh.profile.bundles ??= []
    if (!manifest.dsh.profile.bundles.includes(name)) manifest.dsh.profile.bundles.push(name)
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    const linkPath = join(dir, 'node_modules', name)
    if (!existsSync(linkPath)) {
      mkdirSync(dirname(linkPath), { recursive: true })
      symlinkSync(pluginDir, linkPath, 'dir')
    }
  }

  /** Drop a bundle from the profile composition: bundles row + dependencies + symlink. */
  private async removeFromProfile(dir: string, name: string): Promise<void> {
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { profile?: { bundles?: string[] } }
    }
    let removed = false
    if (manifest.dependencies !== undefined && manifest.dependencies[name] !== undefined) {
      delete manifest.dependencies[name]
      removed = true
    }
    const bundles = manifest.dsh?.profile?.bundles
    if (bundles !== undefined) {
      const at = bundles.indexOf(name)
      if (at !== -1) {
        bundles.splice(at, 1)
        removed = true
      }
    }
    if (removed) {
      await writeFile(`${manifestPath}.bak`, JSON.stringify(manifest, null, 2) + '\n')
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    }
    await rm(join(dir, 'node_modules', name), { recursive: true, force: true })
  }
}

export default PluginInventoryGateway
