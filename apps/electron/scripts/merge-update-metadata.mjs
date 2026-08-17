import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const releaseDirectory = resolve(process.argv[2] ?? join(import.meta.dirname, '..', 'dist', 'release'))
const metadataFiles = (await readdir(releaseDirectory)).filter(file => /^update-metadata-(arm64|x64)\.json$/.test(file))
if (metadataFiles.length === 0) throw new Error('No per-architecture update metadata was found.')

const updates = await Promise.all(metadataFiles.map(async file => JSON.parse(await readFile(join(releaseDirectory, file), 'utf8'))))
const versions = new Set(updates.map(update => update.version))
if (versions.size !== 1) throw new Error(`Cannot publish mixed application versions: ${[...versions].join(', ')}`)

const [update] = updates
const files = updates.flatMap(item => item.files)
const quote = value => JSON.stringify(value)
const metadata = [
  `version: ${quote(update.version)}`,
  'files:',
  ...files.flatMap(file => [
    `  - url: ${quote(file.url)}`,
    `    sha512: ${quote(file.sha512)}`,
    `    size: ${file.size}`,
  ]),
  `path: ${quote(update.path)}`,
  `sha512: ${quote(update.sha512)}`,
  `releaseDate: ${quote(update.releaseDate)}`,
  '',
].join('\n')

await writeFile(join(releaseDirectory, 'latest-mac.yml'), metadata)
console.log(`Merged ${metadataFiles.length} macOS architecture(s) into latest-mac.yml`)
