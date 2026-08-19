/** Host plugin inventory, installer, and remover registered into Web Settings. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PluginManagerResult } from '@deepseek-ai/dsh-api-remotes/client'
import { PluginInventorySettingsTab, type PluginInventorySettingsTabInjected } from './PluginInventorySettingsTab.tsx'
import { PluginInstallSettingsTab, type PluginInstallSettingsTabInjected } from './PluginInstallSettingsTab.tsx'
import { en, zh, type PluginInventoryLocaleKey } from './locales.ts'

export type { PluginInventorySettingsTabInjected, PluginInventorySettingsTabProps } from './PluginInventorySettingsTab.tsx'
export type { PluginInstallSettingsTabInjected, PluginInstallSettingsTabProps } from './PluginInstallSettingsTab.tsx'
export type { PluginInventoryLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Host plugin inventory / installer copy. */
    'settings.pluginInventory': PluginInventoryLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.pluginInventory'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.pluginInventory', 'remote.cliInstall']

/** Normalize a failed Remote call into the shared result shape. */
function failedResult(error: { code: string; message: string }): PluginManagerResult {
  return { ok: false, error: error.code, message: error.message }
}

/** Contribute the plugin-list and install guide tabs to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-plugin-inventory: dictionaries')

  const t = ctx.locale.bind(NS)
  const list: PluginInventorySettingsTabInjected['list'] = async () => {
    const result = await ctx.remote.pluginInventory.list()
    if (!result.ok) {
      throw new Error(`pluginInventory.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const remove: PluginInventorySettingsTabInjected['remove'] = async (name) => {
    const result = await ctx.remote.pluginInventory.remove({ name })
    return result.ok ? result.value : failedResult(result.error)
  }

  const cliStatus = async () => {
    const result = await ctx.remote.cliInstall.status()
    if (!result.ok) {
      throw new Error(`cliInstall.status failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }

  const installCli = async () => {
    const result = await ctx.remote.cliInstall.install({})
    if (!result.ok) {
      return { ok: false, reason: `${result.error.code}: ${result.error.message}` }
    }
    return result.value
  }

  ctx.slots.inject('settings.plugins.tab', () => {
    const disposeList = ctx.slots.register({
      name: 'settings.plugins.tab',
      id: 'all',
      order: 10,
      label: () => t('tab'),
      locale: NS,
      inject: (): PluginInventorySettingsTabInjected => ({ list, remove }),
    }, PluginInventorySettingsTab)
    const disposeInstall = ctx.slots.register({
      name: 'settings.plugins.tab',
      id: 'install',
      order: 11,
      label: () => t('tabInstall'),
      locale: NS,
      inject: (): PluginInstallSettingsTabInjected => ({ cliStatus, installCli }),
    }, PluginInstallSettingsTab)
    return () => {
      disposeList()
      disposeInstall()
    }
  })
}
