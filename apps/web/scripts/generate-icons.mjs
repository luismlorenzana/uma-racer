// Generates the app icons from the drawn mark (T032, docs/design/visual-system.md#type) with no image dependencies:
// PNGs via a tiny zlib-based encoder, and icon.svg from the same numbers, which is also the logo in the top bar.
// Run: pnpm --filter @racer/web icons
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
const blend = (from, to, t) => [mix(from[0], to[0], t), mix(from[1], to[1], t), mix(from[2], to[2], t), 255]

// The mark, in a 100-unit square: a lucky horseshoe, open to the sky, holding a spark. Gold on the stage (Paddock
// tokens). Everything sits inside the maskable safe zone, a circle of radius 40 about the centre.
const STAGE = [0x10, 0x1a, 0x24]
const STAGE_SOFT = [0x1d, 0x2c, 0x3b]
const GOLD = [0xe3, 0xab, 0x3d]
const GOLD_DEEP = [0xb8, 0x7f, 0x18]
const SPARK_INK = [0xf2, 0xf6, 0xfa]
const SHOE = { cx: 50, cy: 49.5, outer: 27, inner: 13.5, top: 23.5, corner: 3.2 }
const HOLES = [[29.75, 32], [29.75, 43], [70.25, 32], [70.25, 43], [36.98, 65.01], [63.02, 65.01]]
const HOLE_R = 1.9
const SPARK = { cx: 50, cy: 38.5, r: 9.8 }
// The spark's sides bow in like a superellipse; 0.525 matches the cubic outline written to icon.svg.
const SPARK_POWER = 0.525

function inArm(x, y, left, right) {
  const { top, corner, cy } = SHOE
  if (x < left || x > right || y < top || y > cy) return false
  if (y >= top + corner) return true
  if (x < left + corner) return Math.hypot(x - left - corner, y - top - corner) <= corner
  if (x > right - corner) return Math.hypot(x - right + corner, y - top - corner) <= corner
  return true
}

function inShoe(x, y) {
  const { cx, cy, outer, inner } = SHOE
  if (y >= cy) {
    const r = Math.hypot(x - cx, y - cy)
    return r <= outer && r >= inner
  }
  return inArm(x, y, cx - outer, cx - inner) || inArm(x, y, cx + inner, cx + outer)
}

const inSpark = (x, y) =>
  Math.abs(x - SPARK.cx) ** SPARK_POWER + Math.abs(y - SPARK.cy) ** SPARK_POWER <= SPARK.r ** SPARK_POWER

/** Shape sample in unit space (0..1). Returns [r,g,b,a]. Full-bleed tile so iOS and Android apply their own mask. */
function sample(u, v) {
  const x = u * 100
  const y = v * 100
  if (inSpark(x, y)) return [...SPARK_INK, 255]
  if (inShoe(x, y)) {
    if (HOLES.some(([hx, hy]) => Math.hypot(x - hx, y - hy) <= HOLE_R)) return [...STAGE, 255]
    return blend(GOLD, GOLD_DEEP, (y - SHOE.top) / (SHOE.cy + SHOE.outer - SHOE.top))
  }
  return blend(STAGE_SOFT, STAGE, v)
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

const n = (value) => Number(value.toFixed(2))
const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
const { cx, cy, outer, inner, top, corner } = SHOE
const arm = outer - inner - 2 * corner
const shoePath = `M${cx - outer + corner} ${top}h${arm}a${corner} ${corner} 0 0 1 ${corner} ${corner}V${cy}` +
  `a${inner} ${inner} 0 0 0 ${2 * inner} 0V${top + corner}a${corner} ${corner} 0 0 1 ${corner}-${corner}h${arm}` +
  `a${corner} ${corner} 0 0 1 ${corner} ${corner}V${cy}a${outer} ${outer} 0 0 1-${2 * outer} 0V${top + corner}` +
  `a${corner} ${corner} 0 0 1 ${corner}-${corner}z`
const k = SPARK.r * 0.28
const q = k * 0.35
const { cx: sx, cy: sy, r } = SPARK
const sparkPath = `M${sx} ${n(sy - r)}C${n(sx + q)} ${n(sy - k)} ${n(sx + k)} ${n(sy - q)} ${n(sx + r)} ${sy}` +
  `C${n(sx + k)} ${n(sy + q)} ${n(sx + q)} ${n(sy + k)} ${sx} ${n(sy + r)}` +
  `C${n(sx - q)} ${n(sy + k)} ${n(sx - k)} ${n(sy + q)} ${n(sx - r)} ${sy}` +
  `C${n(sx - k)} ${n(sy - q)} ${n(sx - q)} ${n(sy - k)} ${sx} ${n(sy - r)}z`
writeFileSync(
  join(outDir, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="stage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(STAGE_SOFT)}"/><stop offset="1" stop-color="${hex(STAGE)}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="${top}" x2="0" y2="${cy + outer}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${hex(GOLD)}"/><stop offset="1" stop-color="${hex(GOLD_DEEP)}"/></linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#stage)"/>
  <path d="${shoePath}" fill="url(#gold)"/>
  <g fill="${hex(STAGE)}">${HOLES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${HOLE_R}"/>`).join('')}</g>
  <path d="${sparkPath}" fill="${hex(SPARK_INK)}"/>
</svg>
`,
)
console.log('wrote icon.svg')
