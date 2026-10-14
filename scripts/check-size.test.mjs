import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { checkSize, entrySrc } from './check-size.mjs'

async function fixture(fn, { entry = 'assets/main.js', imports = [], extra = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'racer-size-test-'))
  try {
    await mkdir(join(root, '.vite'))
    await mkdir(join(root, 'assets'))
    await writeFile(join(root, 'index.html'), `<script crossorigin src="/${entry}" type="module"></script>`)
    const manifest = { 'index.html': { file: entry, isEntry: true, imports, dynamicImports: ['lazy'] },
      lazy: { file: 'assets/phaser.js' }, ...extra }
    await writeFile(join(root, '.vite/manifest.json'), JSON.stringify(manifest))
    await writeFile(join(root, 'assets/main.js'), 'console.log("boot")')
    await writeFile(join(root, 'assets/phaser.js'), noise(300_000))
    for (const node of Object.values(extra)) if (node.file.startsWith('assets/')) await writeFile(join(root, node.file), noise(240_000))
    await fn(root)
  } finally { await rm(root, { recursive: true, force: true }) } // Only this freshly created fixture directory.
}
function noise(length) {
  let seed = 123456789
  return Buffer.from(Array.from({ length }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 24 }))
}

test('finds the module src regardless of attribute order and rejects an absent/ambiguous entry', () => {
  assert.equal(entrySrc('<script src="/assets/main.js" type="module" crossorigin>'), '/assets/main.js')
  assert.throws(() => entrySrc('<script src="/assets/main.js">'), /one module/)
  assert.throws(() => entrySrc('<script type="module" src="a.js"><script type="module" src="b.js">'), /one module/)
})
test('measures the entry, not a large lazy Phaser asset, and includes the exact budget boundary', async () => {
  await fixture(async (root) => {
    const result = await checkSize(root)
    assert.equal(result.files.length, 1)
    assert.equal(result.entry, 'assets/main.js')
    await checkSize(root, result.mainGzip)
    await assert.rejects(checkSize(root, result.mainGzip - 1), /exceeds/)
  })
})
test('counts static imports so a small entry cannot hide oversized initial vendor JS', async () => {
  await fixture(async (root) => { await assert.rejects(checkSize(root), /exceeds/) },
    { imports: ['vendor'], extra: { vendor: { file: 'assets/vendor.js' } } })
})
test('refuses traversal and missing static manifest nodes', async () => {
  await fixture(async (root) => { await assert.rejects(checkSize(root), /Unsafe JS/) }, { entry: '../escape.js' })
  await fixture(async (root) => { await assert.rejects(checkSize(root), /Missing static chunk/) }, { imports: ['missing'] })
})
