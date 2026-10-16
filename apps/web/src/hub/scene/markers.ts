// Code-drawn placeholder buildings (docs/game/11-hub-and-places.md §10.3; ported from uma-rpg's
// `hub/scene/markers.ts`, its T007 markers): drawn at a place's spot when the pinned uma-art lacks its frame, or every
// building when the atlases can't load. One small drawer per frame, centred on (x, y) with its base 18 px below; §10.3's
// four new drawings get theirs in the page's palette, and any other unknown frame a house in it, never an empty box.
// They draw through `Pen`, which Phaser's Graphics already is and `svgPen` records for the DOM (`ui/BuildingSprite`).
import type { Palette } from './palettes'

/** The drawing calls the markers use: a structural slice of Phaser's `GameObjects.Graphics`. */
export interface Pen {
  fillStyle(color: number, alpha?: number): unknown
  fillRect(x: number, y: number, width: number, height: number): unknown
  fillRoundedRect(x: number, y: number, width: number, height: number, radius?: number): unknown
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): unknown
  fillEllipse(x: number, y: number, width: number, height: number): unknown
  fillCircle(x: number, y: number, radius: number): unknown
}

type Draw = (g: Pen, x: number, y: number, palette: Palette) => void

/** Ambient effects a marker asks for; the scene animates them each frame. */
export type Ambient =
  | { kind: 'sway'; x: number; y: number; w: number; color: number }
  | { kind: 'shimmer'; x: number; y: number; w: number; color: number }
  | { kind: 'smoke'; x: number; y: number }
  | { kind: 'glow'; x: number; y: number; r: number; color: number }

/** How far below a marker's centre its base sits: the scene centres a placeholder this far above the ground line. */
export const MARKER_BASE = 18

const shadow = (g: Pen, x: number, y: number, w: number) => {
  g.fillStyle(0x000000, 0.28)
  g.fillEllipse(x, y + 16, w, 9)
}

function plot(g: Pen, x: number, y: number, soil = 0x6e5032) {
  shadow(g, x, y, 60)
  g.fillStyle(0x4a3420, 1)
  g.fillRoundedRect(x - 30, y - 12, 60, 30, 6)
  g.fillStyle(soil, 1)
  g.fillRoundedRect(x - 28, y - 14, 56, 28, 6)
}

function rows(g: Pen, x: number, y: number, color: number, dots = false) {
  for (let i = 0; i < 3; i++) {
    const ry = y - 8 + i * 8
    g.fillStyle(0x5a3f26, 1)
    g.fillRect(x - 24, ry + 2, 48, 3)
    g.fillStyle(color, 1)
    if (dots) for (let k = 0; k < 6; k++) g.fillCircle(x - 20 + k * 8, ry, 2.6)
    else g.fillRect(x - 24, ry - 2, 48, 3)
  }
}

function tree(g: Pen, x: number, y: number, canopy: number, fruit?: number, r = 10) {
  g.fillStyle(0x5b3b22, 1)
  g.fillRect(x - 2, y, 4, 10)
  g.fillStyle(canopy, 1)
  g.fillCircle(x, y - 4, r)
  g.fillStyle(0xffffff, 0.12)
  g.fillCircle(x - r / 3, y - 4 - r / 3, r / 2.2)
  if (fruit !== undefined) {
    g.fillStyle(fruit, 1)
    for (const [dx, dy] of [[-5, -6], [4, -2], [-1, 2], [5, -9]] as const) g.fillCircle(x + dx, y + dy, 1.8)
  }
}

function mound(g: Pen, x: number, y: number, rock: number) {
  shadow(g, x, y, 62)
  g.fillStyle(rock, 1)
  g.fillEllipse(x, y + 2, 62, 36)
  g.fillStyle(0xffffff, 0.1)
  g.fillEllipse(x - 8, y - 6, 34, 14)
}

function house(g: Pen, x: number, y: number, wall: number, roof: number, chimney = false) {
  shadow(g, x, y, 56)
  g.fillStyle(wall, 1)
  g.fillRect(x - 22, y - 6, 44, 24)
  g.fillStyle(roof, 1)
  g.fillTriangle(x - 27, y - 5, x + 27, y - 5, x, y - 22)
  g.fillStyle(0x2b1d12, 1)
  g.fillRect(x - 5, y + 6, 10, 12)
  g.fillStyle(0xffe6a0, 0.9)
  g.fillRect(x + 9, y + 1, 7, 6)
  if (chimney) {
    g.fillStyle(0x5d4a40, 1)
    g.fillRect(x + 11, y - 21, 6, 12)
  }
}

function hall(g: Pen, x: number, y: number, wall: number, roof: number, banner: number) {
  shadow(g, x, y, 66)
  g.fillStyle(wall, 1)
  g.fillRect(x - 30, y - 6, 60, 24)
  g.fillStyle(roof, 1)
  g.fillRect(x - 33, y - 12, 66, 8)
  g.fillTriangle(x - 14, y - 12, x + 14, y - 12, x, y - 26)
  g.fillStyle(banner, 1)
  g.fillRect(x - 24, y - 2, 7, 14)
  g.fillRect(x + 17, y - 2, 7, 14)
  g.fillStyle(0x2b1d12, 1)
  g.fillRect(x - 6, y + 6, 12, 12)
}

// The racer's four buildings as A01 describes them, drawn here until uma-art 2.6.0 drew them, and kept as the stand-in
// for a frame the pinned atlas lacks: walls, roof and trim in the page's palette.

/** A two-storey library: a tall arched window of shelves and a hanging sign with a card on it. */
const cardLibrary: Draw = (g, x, y, { building: { wall, roof, trim } }) => {
  shadow(g, x, y, 58)
  g.fillStyle(wall, 1)
  g.fillRect(x - 24, y - 16, 48, 34)
  g.fillStyle(0x000000, 0.12)
  g.fillRect(x - 24, y + 1, 48, 2)
  g.fillStyle(roof, 1)
  g.fillTriangle(x - 28, y - 15, x + 28, y - 15, x, y - 32)
  g.fillStyle(0x3a2a1c, 1)
  g.fillRoundedRect(x - 7, y - 12, 14, 26, 6)
  g.fillStyle(0xf0d8a0, 1)
  for (let i = 0; i < 3; i++) g.fillRect(x - 5, y - 6 + i * 6, 10, 2)
  g.fillStyle(0x2b1d12, 1)
  g.fillRect(x + 11, y + 6, 8, 12)
  g.fillStyle(trim, 1)
  g.fillRect(x - 21, y - 4, 2, 6)
  g.fillRect(x - 23, y + 2, 9, 11)
  g.fillStyle(0xffffff, 1)
  g.fillRect(x - 21, y + 4, 5, 7)
}

/** A low brick hall with a wide open front: a dumbbell rack inside, a climbing rope, a whistle sign over the door. */
const gym: Draw = (g, x, y, { building: { wall, roof, trim } }) => {
  shadow(g, x, y, 66)
  g.fillStyle(wall, 1)
  g.fillRect(x - 30, y - 10, 60, 28)
  g.fillStyle(0x000000, 0.15)
  for (let i = 0; i < 3; i++) g.fillRect(x - 30, y - 4 + i * 7, 60, 1)
  g.fillStyle(roof, 1)
  g.fillRect(x - 33, y - 17, 66, 8)
  g.fillTriangle(x - 33, y - 17, x + 33, y - 17, x, y - 24)
  g.fillStyle(0xffe6a0, 0.9)
  g.fillRect(x - 28, y - 4, 4, 6)
  g.fillRect(x + 24, y - 4, 4, 6)
  g.fillStyle(0x1e1a22, 1)
  g.fillRect(x - 22, y, 44, 18)
  g.fillStyle(0xb8bcc4, 1)
  g.fillRect(x - 16, y + 9, 16, 2)
  g.fillRect(x - 18, y + 6, 3, 8)
  g.fillRect(x - 1, y + 6, 3, 8)
  g.fillStyle(0xd8b070, 1)
  g.fillRect(x + 12, y + 1, 2, 17)
  g.fillStyle(trim, 1)
  g.fillCircle(x, y - 5, 4)
  g.fillStyle(0xffffff, 0.8)
  g.fillCircle(x, y - 5, 1.6)
}

/** The grandstand: tiered seats under a roof with a pennant, white rails, a strip of turf and the finish post. */
const racecourse: Draw = (g, x, y, { building: { wall, roof, trim } }) => {
  shadow(g, x, y, 72)
  g.fillStyle(wall, 1)
  g.fillRect(x - 30, y - 14, 52, 24)
  for (let i = 0; i < 3; i++) {
    g.fillStyle(i % 2 ? 0xc8c0b0 : 0xa89c88, 1)
    g.fillRect(x - 28, y - 10 + i * 6, 48, 4)
  }
  g.fillStyle(roof, 1)
  g.fillRect(x - 34, y - 20, 60, 6)
  g.fillStyle(0x6a5a46, 1)
  g.fillRect(x + 18, y - 34, 2, 14)
  g.fillStyle(trim, 1)
  g.fillTriangle(x + 20, y - 34, x + 20, y - 26, x + 30, y - 30)
  g.fillStyle(0x4f9a3e, 1)
  g.fillRect(x - 36, y + 10, 72, 8)
  g.fillStyle(0xffffff, 1)
  g.fillRect(x - 36, y + 9, 72, 2)
  for (let i = 0; i < 7; i++) g.fillRect(x - 34 + i * 11, y + 9, 2, 6)
  g.fillRect(x + 29, y - 10, 2, 20)
  g.fillStyle(0xd83a32, 1)
  g.fillCircle(x + 30, y - 12, 5)
  g.fillStyle(0xffffff, 1)
  g.fillCircle(x + 30, y - 12, 2.2)
}

/** A small classical hall: columns, a pediment with a gold cup on its peak, banners in gold and racing green. */
const trophyHall: Draw = (g, x, y, { building: { wall, roof, trim } }) => {
  shadow(g, x, y, 62)
  g.fillStyle(wall, 1)
  g.fillRect(x - 26, y + 12, 52, 6)
  g.fillRect(x - 24, y - 10, 48, 4)
  for (let i = 0; i < 5; i++) g.fillRect(x - 22 + i * 10, y - 6, 4, 18)
  g.fillStyle(0x000000, 0.18)
  g.fillRect(x - 18, y - 6, 36, 18)
  g.fillStyle(wall, 1)
  for (let i = 1; i < 4; i++) g.fillRect(x - 22 + i * 10, y - 6, 4, 18)
  g.fillTriangle(x - 28, y - 10, x + 28, y - 10, x, y - 24)
  g.fillStyle(roof, 1)
  g.fillRect(x - 15, y - 4, 4, 11)
  g.fillStyle(trim, 1)
  g.fillRect(x + 11, y - 4, 4, 11)
  g.fillEllipse(x, y - 29, 10, 8)
  g.fillRect(x - 1, y - 26, 2, 3)
  g.fillRect(x - 3, y - 24, 6, 2)
}

const DRAW: Readonly<Record<string, Draw>> = {
  // Farm (uma-rpg's Farmlands)
  fields: (g, x, y) => { plot(g, x, y); rows(g, x, y, 0xe4c45a) },
  orchard: (g, x, y) => { shadow(g, x, y, 62); tree(g, x - 16, y + 2, 0x4f8f3a, 0xe0483a); tree(g, x + 14, y + 4, 0x56953f, 0xf09a3a); tree(g, x - 1, y - 6, 0x4a8636, 0xe0483a) },
  fishery: (g, x, y) => { shadow(g, x, y, 64); g.fillStyle(0x6b5a3a, 1); g.fillEllipse(x, y + 2, 64, 34); g.fillStyle(0x2f6fa8, 1); g.fillEllipse(x, y + 2, 56, 28); g.fillStyle(0x6cb4e8, 0.5); g.fillEllipse(x - 8, y - 2, 24, 8); g.fillStyle(0x7a5530, 1); g.fillRect(x + 14, y - 14, 14, 4) },
  'herb-garden': (g, x, y) => { plot(g, x, y, 0x5c4a30); rows(g, x, y, 0x7ccf6a, true) },
  'vegetable-garden': (g, x, y) => { plot(g, x, y); rows(g, x, y, 0xf08a2a, true) },
  'mushroom-cave': (g, x, y) => { mound(g, x, y, 0x55525a); g.fillStyle(0x15131a, 1); g.fillEllipse(x, y + 8, 26, 22); for (const [dx, c] of [[-22, 0xd8483a], [20, 0xe6d2b0], [-14, 0xb07ae0]] as const) { g.fillStyle(0xeee0c8, 1); g.fillRect(x + dx - 1, y + 10, 3, 6); g.fillStyle(c, 1); g.fillEllipse(x + dx, y + 10, 10, 6) } },
  'sugar-grove': (g, x, y) => { shadow(g, x, y, 62); for (let i = 0; i < 4; i++) { g.fillStyle(0x8e5ab0, 1); g.fillRect(x + 12 + i * 4, y - 18, 3, 34) } for (const dx of [-22, -6]) { g.fillStyle(0xe6b43a, 1); g.fillRoundedRect(x + dx - 7, y - 4, 14, 18, 3); g.fillStyle(0x8a5a14, 1); g.fillRect(x + dx - 7, y + 2, 14, 2); g.fillRect(x + dx - 7, y + 8, 14, 2) } },
  'nut-grove': (g, x, y) => { shadow(g, x, y, 62); tree(g, x - 14, y + 2, 0x7b8a3a, 0x8a5a2a, 11); tree(g, x + 14, y + 0, 0x6f7f34, 0x8a5a2a, 12) },
  pantry: (g, x, y) => house(g, x, y, 0xcfb894, 0x3f6fa8),
  kitchen: (g, x, y) => house(g, x, y, 0xd8c09a, 0xb4482e, true),
  // Training (uma-rpg's Learning District and Town frames)
  'brawler-dojo': (g, x, y) => hall(g, x, y, 0xd8c8a8, 0x7a2a22, 0xd8483a),
  'party-hall': (g, x, y) => { hall(g, x, y, 0xe0d2b4, 0x3a5a8a, 0xd6a23e); g.fillStyle(0xd6a23e, 1); g.fillTriangle(x - 2, y - 26, x - 2, y - 36, x + 8, y - 31) },
  observatory: (g, x, y) => { shadow(g, x, y, 56); g.fillStyle(0xc8c4d8, 1); g.fillRect(x - 22, y - 2, 44, 20); g.fillStyle(0x4a4a78, 1); g.fillEllipse(x, y - 2, 46, 34); g.fillStyle(0x2a2a48, 1); g.fillRect(x - 3, y - 18, 6, 16); g.fillStyle(0xd6d0f0, 1); g.fillRect(x + 2, y - 26, 18, 5) },
  // Town
  stable: (g, x, y) => { shadow(g, x, y, 62); g.fillStyle(0xa83a2e, 1); g.fillRect(x - 26, y - 6, 52, 24); g.fillStyle(0x6a2a22, 1); g.fillTriangle(x - 30, y - 5, x + 30, y - 5, x, y - 24); g.fillStyle(0xf0e6d0, 1); g.fillRect(x - 9, y + 2, 18, 16); g.fillStyle(0xa83a2e, 1); g.fillRect(x - 1, y + 2, 2, 16) },
  warehouse: (g, x, y) => { shadow(g, x, y, 66); g.fillStyle(0x8a6a48, 1); g.fillRect(x - 30, y - 10, 60, 28); g.fillStyle(0x5a4630, 1); g.fillRect(x - 33, y - 16, 66, 7); for (const dx of [-20, -6]) { g.fillStyle(0xb88a50, 1); g.fillRect(x + dx, y + 6, 12, 12); g.fillStyle(0x6a4a28, 1); g.fillRect(x + dx, y + 11, 12, 2) } g.fillStyle(0x2b1d12, 1); g.fillRect(x + 10, y + 2, 14, 16) },
  exchange: (g, x, y) => { shadow(g, x, y, 62); g.fillStyle(0x7a5a3a, 1); g.fillRect(x - 26, y, 52, 18); for (let i = 0; i < 6; i++) { g.fillStyle(i % 2 ? 0xf0e6d0 : 0x2e8a5a, 1); g.fillRect(x - 28 + i * 9.4, y - 14, 9.4, 12) } g.fillStyle(0x8fd18a, 1); g.fillCircle(x - 10, y + 6, 3); g.fillStyle(0xf2c94c, 1); g.fillCircle(x + 2, y + 6, 3); g.fillCircle(x + 12, y + 6, 3) },
  // Racing
  'scenario-gate': (g, x, y) => { shadow(g, x, y, 76); g.fillStyle(0xa8a090, 1); g.fillRect(x - 34, y - 22, 14, 40); g.fillRect(x + 20, y - 22, 14, 40); g.fillRect(x - 36, y - 28, 72, 10); g.fillStyle(0xd6a23e, 1); g.fillRect(x - 36, y - 30, 72, 3); g.fillStyle(0x1a2030, 0.85); g.fillRect(x - 20, y - 18, 40, 36) },
  'tier-finale': (g, x, y) => { shadow(g, x, y, 70); g.fillStyle(0x9a8a72, 1); g.fillEllipse(x, y + 2, 68, 38); g.fillStyle(0x6a5a46, 1); g.fillEllipse(x, y + 4, 50, 24); g.fillStyle(0x8a6a3a, 1); g.fillEllipse(x, y + 5, 40, 17); for (let i = 0; i < 7; i++) { g.fillStyle(0x3a2e24, 1); g.fillRect(x - 28 + i * 9, y - 12, 4, 6) } g.fillStyle(0xd6a23e, 1); g.fillTriangle(x + 22, y - 18, x + 22, y - 28, x + 32, y - 23) },
  // §10.3's new drawings
  'card-library': cardLibrary,
  gym,
  racecourse,
  'trophy-hall': trophyHall,
}

/** Draws a frame's placeholder centred at (x, y) in the page's palette, and returns the ambient effects it wants. */
export function drawMarker(g: Pen, frame: string, x: number, y: number, palette: Palette): Ambient[] {
  const draw = DRAW[frame]
  if (draw === undefined) house(g, x, y, palette.building.wall, palette.building.roof)
  else draw(g, x, y, palette)
  switch (frame) {
    case 'fishery':
      return [{ kind: 'shimmer', x, y: y + 2, w: 40, color: 0xbfe6ff }]
    case 'fields':
      return [{ kind: 'sway', x, y: y - 8, w: 48, color: 0xf2dc7a }, { kind: 'sway', x, y, w: 48, color: 0xf2dc7a }]
    case 'kitchen':
      return [{ kind: 'smoke', x: x + 14, y: y - 22 }]
    case 'observatory':
      return [{ kind: 'glow', x: x + 11, y: y - 24, r: 8, color: 0xd6d0f0 }]
    case 'trophy-hall':
      return [{ kind: 'glow', x, y: y - 29, r: 8, color: palette.building.trim }]
    default:
      return []
  }
}

/** A recorded shape, for drawing a marker as SVG. */
export type Shape =
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly r: number; readonly fill: string; readonly opacity: number }
  | { readonly kind: 'ellipse'; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number; readonly fill: string; readonly opacity: number }
  | { readonly kind: 'polygon'; readonly points: string; readonly fill: string; readonly opacity: number }

/** A pen that records shapes instead of drawing, so the DOM can draw the same placeholder as SVG. */
export function svgPen(): Pen & { readonly shapes: readonly Shape[] } {
  const shapes: Shape[] = []
  let fill = '#000000'
  let opacity = 1
  return {
    shapes,
    fillStyle(color, alpha = 1) {
      fill = `#${color.toString(16).padStart(6, '0')}`
      opacity = alpha
    },
    fillRect(x, y, w, h) {
      shapes.push({ kind: 'rect', x, y, w, h, r: 0, fill, opacity })
    },
    fillRoundedRect(x, y, w, h, radius = 0) {
      shapes.push({ kind: 'rect', x, y, w, h, r: radius, fill, opacity })
    },
    fillTriangle(x0, y0, x1, y1, x2, y2) {
      shapes.push({ kind: 'polygon', points: `${x0},${y0} ${x1},${y1} ${x2},${y2}`, fill, opacity })
    },
    fillEllipse(x, y, w, h) {
      shapes.push({ kind: 'ellipse', x, y, rx: w / 2, ry: h / 2, fill, opacity })
    },
    fillCircle(x, y, radius) {
      shapes.push({ kind: 'ellipse', x, y, rx: radius, ry: radius, fill, opacity })
    },
  }
}
