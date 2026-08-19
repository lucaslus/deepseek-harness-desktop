/**
 * Client contract of the [directory-picker capability seam](../../host/directory-picker/README.md):
 * the conversation between a surface that needs a host directory and the
 * picking interaction that produces one.
 *
 * A consumer declares a **directory-flow hole** (`single` kind) on the slot
 * entry that renders the interaction, and owns the trigger and whatever it
 * does with the result. The composed picker package's client half fills every
 * hole with one occupant — a renderless native-chooser driver or an in-app
 * browsing dialog — and owns everything between `open` and the reported
 * outcome, including creating a directory to hand back. An unoccupied hole
 * therefore leaves its surface with no picking affordance at all, which is why
 * each consumer also reads its hole's occupancy.
 *
 * The hole keys live here rather than with their declaring entries so a picker
 * half imports one contract instead of one package per consumer.
 *
 * @module @deepseek-ai/dsh-client-ui-directory-flow
 */

import type { HostObservable, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Owner share of every directory-flow hole: the complete conversation between
 * the trigger surface and the picking interaction. The occupant reads `open`
 * to run/render its interaction and reports exactly one outcome per open.
 */
export interface DirectoryFlowOwnerProps {
  /**
   * Localized question the interaction puts to the operator (the OS chooser's
   * prompt, the in-app dialog's title). The owner supplies it because only the
   * owner knows what the directory is for; the occupant owns the rest of the
   * interaction's copy.
   */
  prompt: string
  /** True while a picking interaction is requested; flipping back to false withdraws the request. */
  open: boolean
  /** True while the owner adopts a picked path; occupants disable their commit affordances. */
  busy: boolean
  /** The operator picked a directory (absolute host path); the owner adopts it. */
  onPicked: (path: string) => void
  /** The operator dismissed the interaction; the owner just closes the flow. */
  onCancel: () => void
  /** The interaction itself failed (chooser missing, listing denied); the owner shows its error surface. */
  onError: (message: string) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Directory-flow hole under the conversation empty-state picker (declared by the WorkspacePicker entry). */
    'conversation.hero.workspace.directoryFlow': { kind: 'single'; scope: 'root'; owner: DirectoryFlowOwnerProps }
    /** Directory-flow hole under the sidebar browsing region (declared by the WorkspaceBrowser entry). */
    'sidebar.workspaces.directoryFlow': { kind: 'single'; scope: 'root'; owner: DirectoryFlowOwnerProps }
    /** Directory-flow hole under the plugin install settings tab (declared by the PluginInstallSettingsTab entry). */
    'settings.plugins.install.directoryFlow': { kind: 'single'; scope: 'root'; owner: DirectoryFlowOwnerProps }
  }
}

/** Every directory-flow hole; a picker package's client half registers its one component into all of them. */
export type DirectoryFlowSlotName =
  | 'conversation.hero.workspace.directoryFlow'
  | 'sidebar.workspaces.directoryFlow'
  | 'settings.plugins.install.directoryFlow'

/**
 * Directory-picking share a trigger surface consumes. Occupancy rides the
 * inject face's reserved `hooks` compartment: the renderer binds the source
 * into the `useDirectoryFlow` selector hook, so an empty hole hides the
 * trigger reactively and the surface withdraws an open flow whose occupant
 * unloaded mid-interaction (nobody is left to cancel).
 */
export type DirectoryPickingInjected = {
  hooks: {
    /** True while this surface's directory-flow hole is occupied. */
    directoryFlow: HostObservable<boolean>
  }
}

/** Component-side view of the picking share: the bound occupancy selector hook. */
export type DirectoryPickingHooks = {
  /** Selector hook over this surface's directory-flow occupancy. */
  useDirectoryFlow: SnapshotSelectorHook<boolean>
}
