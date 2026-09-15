// Generates the app icons (original art: a golden horseshoe on a sky-blue tile) with no image dependencies.
// Writes PNGs via a tiny zlib-based encoder and an SVG twin. Run: pnpm --filter @racer/web icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const encodePng = (size, rgba) => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a + (b - a) * t
/** Shape sample in unit space (0..1). Returns [r,g,b,a]. Full-bleed tile so iOS can apply its own mask. */
function sample(x, y) {
  // background: vertical sky gradient
  let color = [mix(0x5c, 0x1f, y), mix(0xc8, 0x8f, y), mix(0xff, 0xe8, y), 255]
  // turf band at the bottom
  if (y > 0.8) color = [0x4c, 0xb8, 0x5a, 255]
  // horseshoe: thick ring open at the bottom
  const dx = x - 0.5
  const dy = y - 0.46
  const r = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx) // 0 = right, +π/2 = down
  const inRing = r > 0.19 && r < 0.3
  const opening = angle > Math.PI * 0.3 && angle < Math.PI * 0.7
  if (inRing && !opening) {
    const shade = 0.85 + 0.15 * (1 - (r - 0.19) / 0.11)
    color = [0xff * shade, 0xc4 * shade, 0x2e * shade, 255]
    // nail holes
    for (const a of [-0.9, -0.35, 0.35, 0.9, 1.4, -1.4]) {
      const hx = Math.cos(a - Math.PI / 2) * 0.245
      const hy = Math.sin(a - Math.PI / 2) * 0.245
      if (Math.hypot(dx - hx, dy - hy) < 0.018) color = [0x8a, 0x5a, 0x10, 255]
    }
  }
  return color
}

function render(size) {
  const ss = 4
  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size)
          for (let i = 0; i < 4; i++) acc[i] += c[i]
        }
      }
      for (let i = 0; i < 4; i++) rgba[(py * size + px) * 4 + i] = Math.round(acc[i] / (ss * ss))
    }
  }
  return encodePng(size, rgba)
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(outDir, name), render(size))
  console.log('wrote', name)
}

writeFileSync(
  join(outDir, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc8ff"/><stop offset="1" stop-color="#1f8fe8"/></linearGradient></defs>
  <rect width="100" height="100" rx="22" fill="url(#sky)"/>
  <rect y="80" width="100" height="20" fill="#4cb85a"/>
  <path d="M35.4 64.6 A24.5 24.5 0 1 1 64.6 64.6" fill="none" stroke="#ffc42e" stroke-width="11" stroke-linecap="round"/>
</svg>
`,
)
console.log('wrote icon.svg')
