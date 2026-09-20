// CLI for verified private content publishing (pnpm content:publish).

import { resolve } from 'node:path'
import { GcloudStorageClient } from './gcloud-storage'
import { publishContent } from './publish'

function argument(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString('en-US')} bytes`
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const bucket = argument('--bucket') ?? process.env.CONTENT_BUCKET ?? 'uma-racer-content'
  const project = argument('--project') ?? 'uma-racer'
  const contentDir = resolve(argument('--content-dir') ?? resolve(import.meta.dirname, '../../..', 'content'))
  const result = await publishContent({ contentDir, storage: new GcloudStorageClient(bucket, project), dryRun })

  console.log(dryRun ? 'Content publish plan (dry run)' : 'Content publish complete')
  console.log(`Local version: ${result.localVersion}`)
  console.log(`Remote version before: ${result.remoteVersionBefore ?? 'none'}`)
  console.log(`Remote version after: ${result.remoteVersionAfter ?? 'none'}${dryRun ? ' (unchanged; dry run)' : ''}`)
  console.log(`Objects: ${result.uploadPaths.length} ${dryRun ? 'to upload' : 'uploaded'}; ${result.alreadyPresentPaths.length} already present`)
  console.log(`Bytes: ${formatBytes(result.totalBytes)} total; ${formatBytes(result.uploadBytes)} ${dryRun ? 'planned' : 'uploaded'}`)
  console.log(`Elapsed: ${(result.elapsedMs / 1_000).toFixed(2)}s`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
