/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-directory-flow`.
 * @module @deepseek-ai/dsh-client-ui-directory-flow/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-directory-flow'

/** Cordis companion plugin name. */
export const name = 'client-ui-directory-flow-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package is a type-only contract — it emits no
 * events and holds no data. The relationships it describes (one occupant per
 * hole, one outcome per open) are asserted by the packages that declare the
 * holes and by each picker half's own behavior specs.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
