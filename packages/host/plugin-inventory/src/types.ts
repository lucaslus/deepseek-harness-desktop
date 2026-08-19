import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable Loader-tree identity of one configured plugin entry. */
export type PluginEntryId = Branded<'PluginEntryId'>

/** Lifecycle state of an entry's root Fiber, or null when it has no live root Fiber. */
export type PluginFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

/** One non-group Loader entry exposed to trusted clients. */
export interface PluginInventoryEntry {
  readonly entryId: PluginEntryId
  /** Exact module specifier imported by the Loader entry. */
  readonly moduleName: string
  /** Effective Loader enablement, including disabled ancestor groups. */
  readonly enabled: boolean
  readonly fiberPhase: PluginFiberPhase
}

/** Point-in-time inventory returned by the plugin inventory Remote. */
export interface PluginInventorySnapshot {
  readonly entries: readonly PluginInventoryEntry[]
}

/**
 * Result of one plugin install/remove operation. `ok: true` carries the
 * package name and the restart requirement; failures carry a machine-readable
 * `error` code plus a human-readable `message`.
 */
export interface PluginManagerResult {
  readonly ok: boolean
  /** Affected package name (present on success). */
  readonly name?: string
  /** True when the profile must restart before the change loads. */
  readonly restartRequired?: boolean
  /** Machine-readable failure code (`not-a-bundle`, `missing-manifest`, …). */
  readonly error?: string
  /** Human-readable failure detail. */
  readonly message?: string
}

export interface CliInstallStatus {
  readonly supported: boolean
  readonly installed: boolean
  readonly path?: string
}

export interface CliInstallResult {
  readonly ok: boolean
  readonly reason?: string
  readonly path?: string
}
