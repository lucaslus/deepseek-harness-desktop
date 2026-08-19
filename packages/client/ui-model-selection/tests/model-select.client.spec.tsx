// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComponentProps } from 'react'
import type { ModelDirectoryState } from '../src/client/directory.ts'
import { ModelSelect } from '../src/client/ModelSelect.tsx'
import { zh } from '../src/client/locales.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'

// The seat's key domain is model ∪ common; the stub mirrors the real lookup
// chain: package dictionary, then common vocabulary, then the key.
const t: ComponentProps<typeof ModelSelect>['t'] = (key, params) => {
  const template = (zh as Record<string, string>)[key]
    ?? (commonZh as Record<string, string>)[key]
    ?? key
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match)
}

const reasoning = {
  efforts: [
    { id: 'off', name: 'Off' },
    { id: 'high', name: 'High' },
    { id: 'max', name: 'Max', description: 'Largest budget' },
  ],
  defaultEffort: 'high',
}

function state(overrides: Partial<ModelDirectoryState> = {}): ModelDirectoryState {
  return {
    current: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    routable: true,
    groups: [{
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', reasoning }],
    }],
    failures: [],
    status: 'ready',
    error: null,
    ...overrides,
  }
}

afterEach(cleanup)

describe('ModelSelect reasoning effort', () => {
  it('renders adapter metadata and submits the effort as part of the session selection', async () => {
    const directory = createSnapshotStore<ModelDirectoryState>(state())
    const select = vi.fn(async (selection: ModelSelection) => {
      directory.set(state({ current: selection }))
      return true
    })
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const trigger = screen.getByRole('button', {
      name: '选择模型，当前 DeepSeek-V4-Flash，推理等级 High',
    })
    // The current route and every model candidate expose the same provider
    // mark, so a route switch never loses its visual provenance.
    expect(trigger.querySelector('img')).not.toBeNull()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' }).querySelector('img')).not.toBeNull()
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent))
      .toEqual(['Off', 'High', 'MaxLargest budget'])

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Max/ }))
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        reasoningEffort: 'max',
      })
      expect(trigger.getAttribute('aria-label')).toBe('选择模型，当前 DeepSeek-V4-Flash，推理等级 Max')
    })
  })

  it('offers provider default only when the adapter does not configure a model default', () => {
    const directory = createSnapshotStore(state({
      groups: [{
        id: 'provider',
        name: 'Provider',
        models: [{
          id: 'model',
          name: 'Model',
          reasoning: { efforts: [{ id: 'standard', name: 'Standard' }] },
        }],
      }],
      current: { provider: 'provider', model: 'model' },
    }))
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={vi.fn().mockResolvedValue(true)}
      t={t}
    />)

    fireEvent.click(screen.getByRole('button', {
      name: '选择模型，当前 Model，推理等级 Default',
    }))
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent))
      .toEqual(['Default', 'Standard'])
  })

  it('prompts for a selection when the current model is no longer advertised', () => {
    const directory = createSnapshotStore(state({
      current: { provider: 'deepseek-official', model: 'removed-model' },
    }))
    const select = vi.fn().mockResolvedValue(true)
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const trigger = screen.getByRole('button', { name: '选择模型' })
    expect(trigger.textContent).toContain('选择模型')
    fireEvent.click(trigger)
    expect(screen.queryByRole('menuitem', { name: /推理等级/ })).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    expect(screen.queryByText('removed-model')).toBeNull()
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeTruthy()
  })

  it('announces a rejected selection as a transient toast and keeps the in-menu strip for loads', async () => {
    const groups = [{
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', reasoning },
        { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
      ],
    }]
    const directory = createSnapshotStore<ModelDirectoryState>(state({ groups }))
    const select = vi.fn(async () => {
      directory.set(state({ groups, status: 'error', error: 'model-unavailable: session already contains images' }))
      return false
    })
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    fireEvent.click(screen.getByRole('button', { name: /选择模型|当前/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /DeepSeek-V4-Pro/ }))
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toContain('模型操作失败：model-unavailable: session already contains images')
    // The selection failure does not render the in-menu load strip (no Retry).
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  })

  it('renders no Agent-bound control for an addressed subagent session', () => {
    const load = vi.fn()
    render(<ModelSelect
      locked={false}
      available={false}
      directory={createSnapshotStore(state())}
      load={load}
      select={vi.fn().mockResolvedValue(false)}
      t={t}
    />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  it('filters models via search input and allows clearing search', () => {
    const groups = [
      {
        id: 'deepseek-official',
        name: 'DeepSeek',
        models: [
          { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash' },
          { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
        ],
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        models: [
          { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
          { id: 'gpt-4o', name: 'GPT-4o' },
        ],
      },
    ]
    const directory = createSnapshotStore<ModelDirectoryState>(state({ groups }))
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={vi.fn().mockResolvedValue(true)}
      t={t}
    />)

    fireEvent.click(screen.getByRole('button', { name: /选择模型/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))

    const searchInput = screen.getByRole('textbox', { name: '搜索模型' })
    expect(searchInput).toBeTruthy()

    // Initially all 4 models are rendered
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'Claude 3.5 Sonnet' })).toBeTruthy()

    // Filter by model name
    fireEvent.change(searchInput, { target: { value: 'claude' } })
    expect(screen.queryByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeNull()
    expect(screen.getByRole('menuitemradio', { name: 'Claude 3.5 Sonnet' })).toBeTruthy()

    // Filter by provider name
    fireEvent.change(searchInput, { target: { value: 'deepseek' } })
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Pro' })).toBeTruthy()
    expect(screen.queryByRole('menuitemradio', { name: 'Claude 3.5 Sonnet' })).toBeNull()

    // Non-matching search shows empty state
    fireEvent.change(searchInput, { target: { value: 'nonexistent-model' } })
    expect(screen.getByText('未找到匹配的模型。')).toBeTruthy()

    // Clear search button restores full list
    const clearButton = screen.getByRole('button', { name: '清除搜索' })
    fireEvent.click(clearButton)
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'Claude 3.5 Sonnet' })).toBeTruthy()
  })

  it('lazily renders models in batches and loads more on scroll', () => {
    const models = Array.from({ length: 100 }, (_, i) => ({
      id: `model-${i}`,
      name: `Model ${i}`,
    }))
    const groups = [{
      id: 'large-provider',
      name: 'Large Provider',
      models,
    }]
    const directory = createSnapshotStore<ModelDirectoryState>(state({ groups }))
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={vi.fn().mockResolvedValue(true)}
      t={t}
    />)

    fireEvent.click(screen.getByRole('button', { name: /选择模型/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))

    // Initial batch is 40 items
    const initialItems = screen.getAllByRole('menuitemradio')
    expect(initialItems.length).toBe(40)

    // Simulate scrolling container to bottom
    const scrollContainer = initialItems[0]?.closest('.scrollable')
    expect(scrollContainer).not.toBeNull()
    if (scrollContainer) {
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 500, configurable: true })
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 800, configurable: true })
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 300, configurable: true })
      fireEvent.scroll(scrollContainer)
    }

    // Next batch loaded: 40 + 40 = 80 items
    expect(screen.getAllByRole('menuitemradio').length).toBe(80)
  })
})
