/**
 * BrandIconPicker: bundled branding for hand-declared provider routes. The
 * saved id is deliberately an asset key rather than a URL/upload, so profiles
 * stay portable and every desktop build can render it offline.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  IconChevronDownOutline14, Menu, PROVIDER_BRAND_OPTIONS, ProviderBrandIcon,
} from '@deepseek-ai/dsh-client-ui-primitives'
import styles from './ModelsSection.module.css'

const GENERIC = '__generic__'

/** Props for {@link BrandIconPicker}. */
export interface BrandIconPickerProps {
  /** Current provider route, used by the neutral fallback only. */
  readonly provider: string
  /** Stored bundled brand id; omission means the neutral route icon. */
  readonly value: string | undefined
  /** Called with omission for the neutral route icon. */
  readonly onChange: (next: string | undefined) => void
  readonly disabled: boolean
  readonly label: string
  readonly genericLabel: string
}

/** Render an icon-bearing menu that selects a bundled provider brand. */
export function BrandIconPicker({ provider, value, onChange, disabled, label, genericLabel }: BrandIconPickerProps): ReactNode {
  const [open, setOpen] = useState(false)
  const selectedId = value ?? GENERIC
  const selected = PROVIDER_BRAND_OPTIONS.find(option => option.id === value)
  const shownLabel = selected?.label ?? genericLabel
  return (
    <div className={styles['field']}>
      <span className={styles['fieldLabel']}>{label}</span>
      <Menu
        open={open}
        portal
        dense
        {...(styles['brandPicker'] === undefined ? {} : { className: styles['brandPicker'] })}
        selectedId={selectedId}
        items={[
          {
            id: GENERIC,
            label: genericLabel,
            icon: <ProviderBrandIcon provider={provider} size={18} />,
          },
          ...PROVIDER_BRAND_OPTIONS.map(option => ({
            id: option.id,
            label: option.label,
            icon: <ProviderBrandIcon provider={provider} brandIcon={option.id} size={18} />,
          })),
        ]}
        onClose={() => { setOpen(false) }}
        onSelect={(id) => {
          onChange(id === GENERIC ? undefined : id)
          setOpen(false)
        }}
        anchor={(
          <button
            type="button"
            className={styles['brandPickerButton']}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled}
            onClick={() => { setOpen(current => !current) }}
          >
            <ProviderBrandIcon provider={provider} brandIcon={value} size={18} />
            <span className={styles['brandPickerName']}>{shownLabel}</span>
            <IconChevronDownOutline14 className={open ? styles['brandPickerChevronOpen'] : undefined} />
          </button>
        )}
      />
    </div>
  )
}
