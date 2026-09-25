// Review sheets for the bust family: every published bust, labelled, in pages the owner can scan on a phone.
// Writes to the gitignored content/review folder; nothing here is published.

import { mkdir, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const contentDir = resolve(repoRoot, 'content')
const TILE = 128
const LABEL = 30
const COLUMNS = 6
const ROWS = 8
const GAP = 8

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as { files: { path: string }[] }
  const busts = manifest.files.filter((file) => file.path.startsWith('art/bust/')).map((file) => file.path).sort()
  const umaPack = (await readdir(resolve(contentDir, 'data'))).find((name) => /^umas\.[a-f0-9]{8}\.json$/.test(name))
  const names = new Map<string, string>()
  if (umaPack) {
    const pack = JSON.parse(await readFile(resolve(contentDir, 'data', umaPack), 'utf8')) as { items: { id: string; name: string; outfit: string | null }[] }
    for (const uma of pack.items) names.set(uma.id, `${uma.name}${uma.outfit ? ` ${uma.outfit}` : ''}`)
  }
  const outDir = resolve(contentDir, 'review')
  await mkdir(outDir, { recursive: true })
  const perPage = COLUMNS * ROWS
  for (let page = 0; page * perPage < busts.length; page += 1) {
    const slice = busts.slice(page * perPage, (page + 1) * perPage)
    const layers: sharp.OverlayOptions[] = []
    for (const [index, path] of slice.entries()) {
      const id = path.split('/').pop()!.split('.')[0]!
      const x = GAP + (index % COLUMNS) * (TILE + GAP)
      const y = GAP + Math.floor(index / COLUMNS) * (TILE + LABEL + GAP)
      const card = Buffer.from(`<svg width="${TILE}" height="${TILE + LABEL}"><rect x="0.5" y="0.5" width="${TILE - 1}" height="${TILE - 1}" rx="12" fill="#ffffff" stroke="#cfd8e6"/>` +
        `<text x="${TILE / 2}" y="${TILE + 12}" font-family="Helvetica" font-size="10" font-weight="bold" text-anchor="middle" fill="#23324a">${escape(id)}</text>` +
        `<text x="${TILE / 2}" y="${TILE + 25}" font-family="Helvetica" font-size="9" text-anchor="middle" fill="#5a6780">${escape((names.get(id) ?? '').slice(0, 26))}</text></svg>`)
      const bust = await sharp(resolve(contentDir, path)).resize(TILE - 8, TILE - 8).png().toBuffer()
      layers.push({ input: card, left: x, top: y }, { input: bust, left: x + 4, top: y + 4 })
    }
    const width = GAP + COLUMNS * (TILE + GAP)
    const height = GAP + Math.ceil(slice.length / COLUMNS) * (TILE + LABEL + GAP)
    const file = resolve(outDir, `busts-${String(page + 1).padStart(2, '0')}.png`)
    await sharp({ create: { width, height, channels: 4, background: '#f4f6fa' } }).composite(layers).png().toFile(file)
    console.log(file)
  }
  console.log(`${busts.length} busts on ${Math.ceil(busts.length / perPage)} pages`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
