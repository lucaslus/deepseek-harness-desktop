import { cp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export default async function copyHarnessRuntime(context) {
  // electron-builder invokes afterPack once per temporary architecture and once
  // after their Universal merge. The Harness runtime is architecture-neutral
  // JavaScript/data, so copying it into temporary apps makes the merger scan
  // hundreds of thousands of unnecessary files.
  if (context.appOutDir.includes('mac-universal-')) return

  const source = resolve(import.meta.dirname, '..', 'dist', 'harness')
  const destination = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources', 'harness')

  await rm(destination, { recursive: true, force: true })
  // The production deployment contains pnpm links. A release app must be
  // relocatable, so copy their contents instead of preserving their paths.
  await cp(source, destination, { recursive: true, dereference: true })
}
