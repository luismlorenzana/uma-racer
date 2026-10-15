// The startup JS budget (docs/research/game-web-tech.md, D337), from uma-rpg's D56/H16 check: measure the real HTML
// entry and every chunk it statically imports, not the largest asset (PixiJS, Phaser and Firebase are deliberately lazy).
// `node check-size.mjs [dist] [html]`: today's app is `dist index.html`; the new game's measure build (T137) is
// `dist-g2 g2.html`. Today's build must also hold no module of the new game (`src/g2/`), which only T143 makes the entry.
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

export const MAIN_JS_BUDGET = 180_000
const G2_SOURCES = 'src/g2/'

export function entrySrc(html, name = 'index.html') {
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].filter(([tag]) => /\btype\s*=\s*["']module["']/i.test(tag))
  const sources = scripts.flatMap(([tag]) => {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    return src ? [src] : []
  })
  if (sources.length !== 1) throw new Error(`Expected one module entry in ${name}`)
  return sources[0]
}
function assetPath(distDir, source) {
  if (typeof source !== 'string' || !/^\/?assets\/[\w.-]+\.js$/.test(source)) throw new Error(`Unsafe JS asset: ${source}`)
  const root = resolve(distDir), file = resolve(root, source.replace(/^\//, ''))
  if (!file.startsWith(root + sep)) throw new Error('JS asset leaves dist')
  return file
}
function htmlPath(distDir, name) {
  if (!/^[\w-]+\.html$/.test(name)) throw new Error(`Unsafe HTML entry: ${name}`)
  return resolve(distDir, name)
}

export async function checkSize(distDir, budget = MAIN_JS_BUDGET, htmlName = 'index.html') {
  const html = await readFile(htmlPath(distDir, htmlName), 'utf8')
  const src = entrySrc(html, htmlName), entry = src.replace(/^\//, '')
  const manifest = JSON.parse(await readFile(resolve(distDir, '.vite/manifest.json'), 'utf8'))
  if (htmlName === 'index.html') {
    const g2 = Object.entries(manifest).filter(([key, node]) => key.startsWith(G2_SOURCES) || node.src?.startsWith(G2_SOURCES))
    if (g2.length > 0) throw new Error(`Today's build holds the new game's modules: ${g2.map(([key]) => key).join(', ')}`)
  }
  const main = Object.entries(manifest).find(([, node]) => node.isEntry && node.file === entry)
  if (!main) throw new Error('HTML entry is missing from the build manifest')
  const seen = new Set(), files = []
  const visit = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const node = manifest[key]
    if (!node) throw new Error(`Missing static chunk: ${key}`)
    assetPath(distDir, node.file)
    files.push(node.file)
    for (const dependency of node.imports ?? []) visit(dependency)
  }
  visit(main[0]) // Dynamic imports are intentionally excluded; static vendor splitting cannot evade the budget.
  const sizes = await Promise.all(files.map(async (file) => ({ file, gzip: gzipSync(await readFile(assetPath(distDir, file))).byteLength })))
  const mainGzip = sizes.find((s) => s.file === entry).gzip
  const initialGzip = sizes.reduce((sum, s) => sum + s.gzip, 0)
  if (mainGzip > budget || initialGzip > budget) throw new Error(`Initial JS ${initialGzip} bytes gzip (main ${mainGzip}) exceeds ${budget}`)
  return { entry, mainGzip, initialGzip, files: sizes }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const html = process.argv[3] ?? 'index.html'
    const result = await checkSize(resolve(process.argv[2] ?? 'dist'), MAIN_JS_BUDGET, html)
    console.log(`${html} main JS: ${(result.mainGzip / 1000).toFixed(2)} KB gzip / ${MAIN_JS_BUDGET / 1000} KB budget`)
    console.log(`${html} initial JS: ${(result.initialGzip / 1000).toFixed(2)} KB gzip across ${result.files.length} static chunk(s)`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
