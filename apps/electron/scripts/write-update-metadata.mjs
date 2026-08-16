import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const arch = process.argv[2] ?? process.arch
if (!['arm64', 'x64', 'universal'].includes(arch)) {
  throw new Error(`Unsupported macOS architecture: ${arch}`)
}

const electronDirectory = resolve(import.meta.dirname, '..')
const releaseDirectory = join(electronDirectory, 'dist', 'release')
const { version } = JSON.parse(await readFile(join(electronDirectory, 'package.json'), 'utf8'))
const zipName = `DeepSeek Harness-${version}-${arch}.zip`
const zipPath = join(releaseDirectory, zipName)
const zip = await readFile(zipPath)
const sha512 = createHash('sha512').update(zip).digest('base64')
const { size } = await stat(zipPath)
const quote = value => JSON.stringify(value)
const releaseDate = new Date().toISOString()
const file = { url: zipName, sha512, size }
const update = { version, files: [file], path: zipName, sha512, releaseDate }
const metadata = [
  `version: ${quote(update.version)}`,
  'files:',
  `  - url: ${quote(file.url)}`,
  `    sha512: ${quote(file.sha512)}`,
  `    size: ${file.size}`,
  `path: ${quote(update.path)}`,
  `sha512: ${quote(update.sha512)}`,
  `releaseDate: ${quote(update.releaseDate)}`,
  '',
].join('\n')

await writeFile(join(releaseDirectory, `update-metadata-${arch}.json`), `${JSON.stringify(update, null, 2)}\n`)
await writeFile(join(releaseDirectory, 'latest-mac.yml'), metadata)
console.log(`Wrote update metadata for ${zipName}`)
