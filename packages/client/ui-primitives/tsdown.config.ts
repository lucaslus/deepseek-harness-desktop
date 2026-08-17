import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { clientOnly } from '../tsdown.client.ts'

/**
 * ui-primitives is browser-only, but its lib bundle IS imported under plain
 * Node because the web shell is a lib (dsh-client-web's lib chain reaches
 * this package). CSS imports are therefore stubbed to empty modules instead
 * of externalized — the hashed class maps only matter in bundler contexts
 * (loader module table / vite source paths), which compile src directly and
 * never read lib.
 */
export default clientOnly([{
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  plugins: [{
    name: 'dsh-css-stub',
    resolveId(source: string) {
      if (!source.endsWith('.css')) return null
      return `\0dsh-css-stub:${source}.mjs`
    },
    load(id: string) {
      if (!id.startsWith('\0dsh-css-stub:')) return null
      return 'export default {};'
    },
  }, {
    // ui-primitives owns the global provider-brand map. Its static SVGs must
    // travel with the library instead of becoming browser URLs that a plugin
    // bundle cannot serve from a package's node_modules directory.
    name: 'dsh-svg-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.svg') || importer === undefined) return null
      return `\0dsh-svg:${createRequire(importer).resolve(source)}.mjs`
    },
    async load(id: string) {
      if (!id.startsWith('\0dsh-svg:')) return null
      const file = id.slice('\0dsh-svg:'.length, -'.mjs'.length)
      this.addWatchFile(file)
      return `export default ${JSON.stringify(`data:image/svg+xml,${encodeURIComponent(await readFile(file, 'utf8'))}`)};`
    },
  }],
}])
