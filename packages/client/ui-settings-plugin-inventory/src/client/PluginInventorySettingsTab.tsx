import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { PluginInventorySnapshot, PluginManagerResult } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconChevronDownOutline14,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginInventoryLocaleKey } from './locales.ts'
import css from './PluginInventorySettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface PluginInventorySettingsTabInjected {
  /** Read a current Host inventory snapshot. */
  list: () => Promise<PluginInventorySnapshot>
  /** Install a plugin bundle into the active profile from a path or GitHub source. */
  install: (source: string) => Promise<PluginManagerResult>
  /** Remove an installed plugin bundle by package name. */
  remove: (name: string) => Promise<PluginManagerResult>
}

type PluginInventoryEntry = PluginInventorySnapshot['entries'][number]
type PluginFiberPhase = PluginInventoryEntry['fiberPhase']

/** Full component props assembled by the Settings slot renderer. */
export type PluginInventorySettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInventory'>
  & InjectFace<PluginInventorySettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: PluginInventorySnapshot }

const PHASE_KEYS = {
  pending: 'pending',
  loading: 'loadingPhase',
  active: 'active',
  failed: 'failed',
  unloading: 'unloading',
} satisfies Record<Exclude<PluginFiberPhase, null>, PluginInventoryLocaleKey>

/** Localized accessible label for one root Fiber phase. */
function phaseLabel(
  phase: PluginFiberPhase,
  t: PluginInventorySettingsTabProps['t'],
): string {
  return phase === null ? t('unobserved') : t(PHASE_KEYS[phase])
}

/** Compact a module specifier without guessing whether its Loader id was generated. */
function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return unscoped
    .replace(/^cordis:/, '')
    .replace(/^cordis-plugin-/, '')
    .replace(/^dsh-(?:host-|client-)?/, '')
}

/** Whether an inventory row matches the local catalog query. */
function matches(entry: PluginInventoryEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [entry.moduleName, entry.entryId]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/** Install/remove operation notice shown above the catalog. */
type InstallerNotice =
  | { readonly kind: 'working'; readonly what: 'install' | 'remove' }
  | { readonly kind: 'error'; readonly what: 'install' | 'remove'; readonly message: string }
  | { readonly kind: 'done'; readonly message: string }

/** Render the current Loader inventory plus profile-level install/remove. */
export function PluginInventorySettingsTab({ list, install, remove, t }: PluginInventorySettingsTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<PluginInventoryEntry['entryId'] | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [source, setSource] = useState('')
  const [notice, setNotice] = useState<InstallerNotice | null>(null)

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.entries.filter(entry => matches(entry, normalizedQuery))
      : [],
    [normalizedQuery, state],
  )

  useEffect(() => {
    if (expanded !== null && !filteredEntries.some(entry => entry.entryId === expanded)) {
      setExpanded(null)
    }
  }, [expanded, filteredEntries])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const runInstall = async (): Promise<void> => {
    const trimmed = source.trim()
    if (trimmed.length === 0 || notice?.kind === 'working') return
    setNotice({ kind: 'working', what: 'install' })
    try {
      const result = await install(trimmed)
      if (!result.ok) {
        const detail = result.message === undefined ? '' : `: ${result.message}`
        setNotice({ kind: 'error', what: 'install', message: `${result.error ?? ''}${detail}` })
      } else {
        setNotice({ kind: 'done', message: t('installDone', { name: result.name ?? trimmed }) })
        setSource('')
      }
    } catch (error) {
      setNotice({ kind: 'error', what: 'install', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const runRemove = async (name: string): Promise<void> => {
    if (notice?.kind === 'working') return
    setNotice({ kind: 'working', what: 'remove' })
    try {
      const result = await remove(name)
      if (!result.ok) {
        const detail = result.message === undefined ? '' : `: ${result.message}`
        setNotice({ kind: 'error', what: 'remove', message: `${result.error ?? ''}${detail}` })
      } else {
        setNotice({ kind: 'done', message: t('removeDone', { name }) })
      }
    } catch (error) {
      setNotice({ kind: 'error', what: 'remove', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      <div className={css.installer}>
        <h3>{t('installTitle')}</h3>
        <div className={css.installRow}>
          <input
            type="text"
            value={source}
            placeholder={t('installPlaceholder')}
            aria-label={t('installTitle')}
            disabled={notice?.kind === 'working'}
            onChange={(event) => { setSource(event.currentTarget.value) }}
            onKeyDown={(event) => { if (event.key === 'Enter') void runInstall() }}
          />
          <button
            type="button"
            disabled={notice?.kind === 'working' || source.trim().length === 0}
            onClick={() => void runInstall()}
          >
            {notice?.kind === 'working' && notice.what === 'install' ? t('installing') : t('install')}
          </button>
        </div>
        {notice !== null && notice.kind === 'error'
          ? <p className={css.installerError} role="alert">{t(notice.what === 'install' ? 'installError' : 'removeError')}: {notice.message}</p>
          : null}
        {notice !== null && notice.kind === 'done'
          ? <p className={css.installerDone}>{notice.message}</p>
          : null}
        {notice !== null && notice.kind === 'working'
          ? <p className={css.installerHint}>{t(notice.what === 'install' ? 'installing' : 'removing')}</p>
          : null}
      </div>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <label className={css.search}>
            <IconSearchOutline16 aria-hidden="true" />
            <span className={css.visuallyHidden}>{t('search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label>
          <div className={css.catalogHeading}>
            <h3>{t('catalog')}</h3>
            <span data-plugin-count={filteredEntries.length}>{filteredEntries.length}</span>
          </div>
          {state.snapshot.entries.length === 0 ? <p className={css.status}>{t('empty')}</p> : null}
          {state.snapshot.entries.length > 0 && filteredEntries.length === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}
          {filteredEntries.length > 0 ? (
            <ul className={css.cards}>
              {filteredEntries.map((entry) => {
                const status = phaseLabel(entry.fiberPhase, t)
                const title = moduleShortName(entry.moduleName)
                const configuration = t(entry.enabled ? 'enabledTag' : 'disabledTag')
                const open = expanded === entry.entryId
                const detailId = `${catalogId}-details-${encodeURIComponent(entry.entryId)}`
                return (
                  <li
                    className={css.card}
                    key={entry.entryId}
                    data-plugin-entry={entry.entryId}
                    data-open={open ? 'true' : undefined}
                  >
                    <button
                      className={css.cardContent}
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-label={entry.enabled ? `${title}, ${status}, ${configuration}` : `${title}, ${configuration}`}
                      onClick={() => {
                        setExpanded(current => current === entry.entryId ? null : entry.entryId)
                      }}
                    >
                      <strong className={css.cardTitle} title={entry.moduleName}>{title}</strong>
                      <span className={css.cardTrailing}>
                        {entry.enabled ? (
                          <span
                            className={css.statusDot}
                            data-phase={entry.fiberPhase ?? 'unobserved'}
                            role="img"
                            aria-label={status}
                            title={status}
                          />
                        ) : null}
                        <span className={css.configTag} data-enabled={entry.enabled ? 'true' : 'false'}>
                          {configuration}
                        </span>
                        <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                      </span>
                    </button>
                    {open ? (
                      <div className={css.cardDetails} id={detailId}>
                        <code className={css.entryValue} data-loader-entry>{entry.entryId}</code>
                        <dl className={css.details}>
                          <div>
                            <dt>{t('configuration')}</dt>
                            <dd>{configuration}</dd>
                          </div>
                          {entry.enabled ? (
                            <div>
                              <dt>{t('cordis')}</dt>
                              <dd>{status}</dd>
                            </div>
                          ) : null}
                        </dl>
                        <div className={css.cardActions}>
                          <button
                            type="button"
                            className={css.removeButton}
                            disabled={notice?.kind === 'working'}
                            onClick={() => void runRemove(entry.moduleName)}
                          >
                            {notice?.kind === 'working' && notice.what === 'remove' ? t('removing') : t('remove')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
