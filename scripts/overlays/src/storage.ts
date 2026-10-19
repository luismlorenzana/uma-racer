// Scoped maintenance transport. No gcloud configuration is changed; tokens never enter output or files (SE1).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
export async function storage(project: string, bucket: string) {
  const { stdout } = await exec('gcloud', ['auth', 'print-access-token'], { env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'default', CLOUDSDK_CORE_PROJECT: project } })
  const token = stdout.trim()
  const base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`
  const request = async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
    if (!response.ok && response.status !== 404) throw new Error(`Storage request failed (${response.status})`)
    return response
  }
  return {
    async read(path: string): Promise<Uint8Array | null> {
      const response = await request(`${base}/${encodeURIComponent(path)}?alt=media`)
      return response.status === 404 ? null : new Uint8Array(await response.arrayBuffer())
    },
    async info(path: string): Promise<{ generation: string } | null> {
      const response = await request(`${base}/${encodeURIComponent(path)}?fields=generation`)
      return response.status === 404 ? null : await response.json() as { generation: string }
    },
    async put(path: string, bytes: Uint8Array, generation: string) {
      await request(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}&ifGenerationMatch=${generation}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': path === 'overlay.json' ? 'no-cache' : 'private, max-age=31536000, immutable' }, body: bytes as Uint8Array<ArrayBuffer> })
    },
    async list(): Promise<{ name: string; generation: string; size: string }[]> {
      const items: { name: string; generation: string; size: string }[] = []
      let next = ''
      do {
        const response = await request(`${base}?fields=items(name,generation,size),nextPageToken&maxResults=1000${next ? `&pageToken=${encodeURIComponent(next)}` : ''}`)
        const page = await response.json() as { items?: typeof items; nextPageToken?: string }
        items.push(...page.items ?? []); next = page.nextPageToken ?? ''
      } while (next)
      return items
    },
    async remove(path: string, generation: string) {
      await request(`${base}/${encodeURIComponent(path)}?ifGenerationMatch=${generation}`, { method: 'DELETE' })
    },
  }
}
