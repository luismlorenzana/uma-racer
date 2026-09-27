// Gcloud adapter for the project-scoped private content publisher.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ContentStorageClient, RemoteObjectState } from './publish'

const execute = promisify(execFile)
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/

interface CommandFailure extends Error {
  code?: number | string
  stderr?: string
}

function isMissing(error: CommandFailure): boolean {
  return /(?:404|not found|no urls matched|does not exist)/i.test(error.stderr ?? error.message)
}

function friendlyFailure(error: CommandFailure): Error {
  const detail = (error.stderr ?? error.message).trim()
  if (/(?:credential|login|authentication|account.*not|reauth)/i.test(detail)) {
    return new Error(`Content bucket credentials are unavailable. Refresh the owner's default ADC/gcloud session and retry. ${detail}`)
  }
  if (/(?:network|dns|timed out|timeout|unavailable|connection|resolve)/i.test(detail)) {
    return new Error(`Content bucket is unreachable. Check the network and retry. ${detail}`)
  }
  return new Error(`Content bucket command failed. ${detail}`)
}

export class GcloudStorageClient implements ContentStorageClient {
  constructor(
    private readonly bucket: string,
    private readonly project = 'uma-racer',
  ) {
    if (!BUCKET_PATTERN.test(bucket)) throw new Error(`Invalid content bucket name: ${bucket}`)
  }

  private uri(path: string): string {
    return `gs://${this.bucket}/${path}`
  }

  private async run(args: readonly string[]): Promise<string> {
    try {
      const result = await execute('gcloud', [...args], {
        env: {
          ...process.env,
          CLOUDSDK_ACTIVE_CONFIG_NAME: 'default',
          CLOUDSDK_CORE_PROJECT: this.project,
        },
        maxBuffer: 10 * 1024 * 1024,
      })
      return result.stdout
    } catch (error) {
      throw friendlyFailure(error as CommandFailure)
    }
  }

  async readManifest(): Promise<unknown | null> {
    try {
      const value = await this.run(['storage', 'cat', this.uri('manifest.json')])
      return JSON.parse(value) as unknown
    } catch (error) {
      if (isMissing(error as CommandFailure)) return null
      throw error
    }
  }

  async objectState(path: string): Promise<RemoteObjectState | null> {
    try {
      const value = await this.run(['storage', 'objects', 'describe', this.uri(path), '--format=value(size)'])
      const bytes = Number(value.trim())
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error(`Bucket returned an invalid size for ${path}`)
      return { bytes }
    } catch (error) {
      if (isMissing(error as CommandFailure)) return null
      throw error
    }
  }

  async listObjects(): Promise<ReadonlyMap<string, number>> {
    const value = await this.run(['storage', 'objects', 'list', this.uri('**'), '--format=value(name,size)'])
    const sizes = new Map<string, number>()
    for (const line of value.split('\n')) {
      if (!line.trim()) continue
      const [name, size] = line.split('\t')
      const bytes = Number(size)
      if (!name || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error(`Bucket listing returned an invalid row: ${line}`)
      sizes.set(name, bytes)
    }
    return sizes
  }

  async upload(localPath: string, objectPath: string): Promise<void> {
    await this.run(['storage', 'cp', localPath, this.uri(objectPath)])
  }
}
