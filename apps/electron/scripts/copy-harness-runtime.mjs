import { cp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export default async function copyHarnessRuntime(context) {
  const source = resolve(import.meta.dirname, '..', 'dist', 'harness')
  const destination = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources', 'harness')

  await rm(destination, { recursive: true, force: true })
  // The production deployment contains pnpm links. A release app must be
  // relocatable, so copy their contents instead of preserving their paths.
  await cp(source, destination, { recursive: true, dereference: true })
}
