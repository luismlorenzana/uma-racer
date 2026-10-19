// Run only AFTER production verifies the new source. A generation change aborts, never deletes a replacement (SE1).
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CONTENT } from './local'
import { storage } from './storage'
import { retiredMasterObject } from './retired'

async function main() {
  const remote = await storage('uma-racer', 'uma-racer-content')
  const old = await remote.read('manifest.json')
  const version = old === null ? null : (JSON.parse(new TextDecoder().decode(old)) as { version: string }).version
  const targets = (await remote.list()).filter((file) => retiredMasterObject(file.name))
  const totalBytes = targets.reduce((sum, file) => sum + Number(file.size), 0)
  await mkdir(resolve(CONTENT, 'review'), { recursive: true })
  await writeFile(resolve(CONTENT, 'review/se1-retired-objects.json'), JSON.stringify({ version, targets }, null, 2))
  console.log(`Retired master objects: ${targets.length}; bytes: ${totalBytes}; old version: ${version ?? 'absent'}`)
  if (!process.argv.includes('--delete')) return
  if (!/^[a-f0-9]{40}$/.test(process.env.VERIFIED_DEPLOY_SHA ?? '') || !process.env.VERIFIED_MASTER_VERSION || version !== process.env.RETIRED_MASTER_VERSION) throw new Error('A verified deployment SHA, master version and matching retired version are required')
  const platform = await storage('uma-platform-lm', 'uma-platform-master-data')
  const channel = await platform.read('channels/v1/latest.json')
  if (!channel || (JSON.parse(new TextDecoder().decode(channel)) as { version: string }).version !== process.env.VERIFIED_MASTER_VERSION || await remote.read('overlay.json') === null) throw new Error('Cutover sources changed or are missing')
  // Keep the old pointer until all of its immutable objects have retired. Every deletion has a generation precondition.
  const files = targets.filter((file) => file.name !== 'manifest.json')
  for (let i = 0; i < files.length; i += 16) await Promise.all(files.slice(i, i + 16).map((file) => remote.remove(file.name, file.generation)))
  for (const pointer of targets.filter((file) => file.name === 'manifest.json')) await remote.remove(pointer.name, pointer.generation)
  const remaining = (await remote.list()).filter((file) => retiredMasterObject(file.name))
  if (remaining.length) throw new Error('Retired objects remain; inspect the private inventory')
  console.log(`Deleted and rechecked ${targets.length} retired objects; overlays, authored sources and all saves untouched`)
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Retirement failed'); process.exitCode = 1 })
