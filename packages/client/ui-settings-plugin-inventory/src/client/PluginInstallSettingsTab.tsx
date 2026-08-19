import { useState, useEffect, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CliInstallResult, CliInstallStatus } from '@deepseek-ai/dsh-host-plugin-inventory/types'
import css from './PluginInstallSettingsTab.module.css'

export interface PluginInstallSettingsTabInjected {
  cliStatus: () => Promise<CliInstallStatus>
  installCli: () => Promise<CliInstallResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type PluginInstallSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInventory'>
  & InjectFace<PluginInstallSettingsTabInjected>

/** Guide showing how to install plugins and an option to install the CLI. */
export function PluginInstallSettingsTab(
  { t, cliStatus: fetchCliStatus, installCli: runInstallCli }: PluginInstallSettingsTabProps,
): ReactNode {
  const [cliStatus, setCliStatus] = useState<CliInstallStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installResult, setInstallResult] = useState<CliInstallResult | null>(null)

  // Fetch status on mount
  useEffect(() => {
    fetchCliStatus().then(setCliStatus).catch(console.error)
  }, [fetchCliStatus])

  const handleInstallCli = async () => {
    setInstalling(true)
    try {
      const result = await runInstallCli()
      setInstallResult(result)
      if (result.ok) {
        setCliStatus((prev) => {
          if (!prev) return null
          return result.path !== undefined
            ? { ...prev, installed: true, path: result.path }
            : { ...prev, installed: true }
        })
      }
    } catch (e) {
      setInstallResult({ ok: false, reason: String(e) })
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className={css.section}>
      <p className={css.intro}>{t('installGuideIntro')}</p>

      {cliStatus?.supported && (
        <section className={css.group}>
          <h3 className={css.heading}>{t('installCliHeading')}</h3>
          <p className={css.description}>{t('installCliDescription')}</p>
          <div className={css.cliAction}>
            <Button
              variant="primary"
              disabled={installing || cliStatus.installed}
              onClick={() => void handleInstallCli()}
            >
              {cliStatus.installed ? t('installCliDone') : (installing ? t('installing') : t('installCli'))}
            </Button>
            {cliStatus.installed && cliStatus.path && (
              <span className={css.successMessage}>
                Installed to: <code>{cliStatus.path}</code>
                <br />
                {t('installCliPathHint')}
              </span>
            )}
            {installResult && !installResult.ok && (
              <span className={css.errorMessage}>{installResult.reason}</span>
            )}
          </div>
        </section>
      )}

      <section className={css.group}>
        <h3 className={css.heading}>{t('installGuideAddHeading')}</h3>
        <p className={css.description}>{t('installGuideAddCmd')}</p>
        <pre className={css.codeBlock}><code>dsh plugin --profile web add @scope/my-plugin</code></pre>
        <p className={css.description}>{t('installGuideAddLocal')}</p>
        <pre className={css.codeBlock}><code>dsh plugin --profile web add ~/dev/my-plugin</code></pre>
        <p className={css.description}>{t('installGuideAddGit')}</p>
        <pre className={css.codeBlock}><code>dsh plugin --profile web add github:owner/repo</code></pre>
      </section>

      <section className={css.group}>
        <h3 className={css.heading}>{t('installGuideRemoveHeading')}</h3>
        <p className={css.description}>{t('installGuideRemoveCmd')}</p>
        <pre className={css.codeBlock}><code>dsh plugin --profile web remove @scope/my-plugin</code></pre>
      </section>

      <p className={css.note}>{t('installGuideProfileNote')}</p>
    </div>
  )
}
