# @deepseek-ai/dsh-client-ui-directory-flow

English | [中文](README.zh.md)

The browser-side contract of the [directory-picker capability seam](../../host/directory-picker/README.md). It is types only — no runtime, no React, no cordis.

A surface that needs a host directory declares a **directory-flow hole** (`single` kind) on the slot entry that renders the interaction, and passes `DirectoryFlowOwnerProps` when it renders that hole: `prompt` (the localized question the operator sees), `open`, `busy`, and the three outcome callbacks (`onPicked` / `onCancel` / `onError`). The composed picker package's client half fills every hole with one occupant and reports exactly one outcome per `open` — so the owner never learns which interaction ran, and no client code branches on a capability kind. `prompt` belongs to the owner because only the owner knows what the directory is for; the occupant owns the rest of the interaction's copy. It reaches the OS chooser through `host.pickDirectory` and titles the in-app browsing dialog.

The three hole keys (`sidebar.workspaces.directoryFlow`, `conversation.hero.workspace.directoryFlow`, `settings.plugins.install.directoryFlow`) are declaration-merged into `SlotMap` here rather than beside their declaring entries, so a picker half imports this one contract instead of one package per consumer. `DirectoryPickingInjected` / `DirectoryPickingHooks` carry the hole's occupancy into the owner: an unoccupied hole means the composition has no picking affordance, and every consumer hides its trigger rather than leaving a dead one. Rationale for the seam's split and its policy decisions: [the directory-picker capability seam Agent Note](../../../.agents/notes/implemented/architecture/2026-07-28-directory-picker-capability-seam.md).

## Model Experience

None, as the contract serves the GUI host's directory selection; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The hole set is a closed union** — a new consumer adds its key here and to both picker halves' registrations, because a slot name cannot be computed at the `slots.inject` call site. A registry that lets a picker fill holes it does not name waits for a consumer count that makes the indirection pay.
