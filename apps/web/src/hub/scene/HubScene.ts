// The Hub map scene (docs/game/11-hub-and-places.md §1, §10, §12; ported from uma-rpg's `hub/scene/HubScene.ts`, its
// D61, D64 and P38): the page's pixel-art terrain and building sprites from uma-art, laid on the shared grid and stamped
// once into one texture, with gentle ambient life on top: drifting clouds, chimney smoke from frames that carry
// `smoke`, and glows. World units are CSS pixels; the camera zooms by the device pixel ratio, so art pixels land on
// whole device pixels. No text: names, pips and badges are DOM links over the canvas (uma-rpg D33). A frame the pinned
// atlas lacks (§10.3's four new drawings) is drawn as its code placeholder in the page's palette, and if the atlases
// can't load at all, every building is.
import buildingsIndex from '@luismlorenzana/uma-art/buildings/atlas.json'
import buildingsUrl from '@luismlorenzana/uma-art/buildings/atlas.png?url'
import tilesIndex from '@luismlorenzana/uma-art/tiles/atlas.json'
import tilesUrl from '@luismlorenzana/uma-art/tiles/atlas.png?url'
import type { HubPage, PlaceAt } from '@racer/domain/hub'
import Phaser from 'phaser'
import { ART_TILE, hubGrid, placeAnchor } from '../grid'
import { drawMarker, MARKER_BASE, type Ambient } from './markers'
import { PALETTES } from './palettes'
import { layTerrain, tilePageFor } from './terrain'

type Frames = Record<string, { x: number; y: number; w: number; h: number; smoke?: { x: number; y: number } }>
const TILES = 'hub-tiles'
const BUILDINGS = 'hub-buildings'
const TILE_FRAMES = tilesIndex.frames as Frames
const BUILDING_FRAMES = buildingsIndex.frames as Frames

/** The fallback ground's cell, in CSS px. */
const TILE = 24

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A place as the scene draws it: where it stands and which frame it is. */
export interface HubScenePlace {
  readonly id: string
  readonly frame: string
  readonly at: PlaceAt
}

export interface HubSceneState {
  readonly page: HubPage
  readonly places: readonly HubScenePlace[]
  /** Spots kept clear of props: the Town Hall plaza. */
  readonly clearings: readonly PlaceAt[]
  readonly reducedMotion: boolean
}

export class HubScene extends Phaser.Scene {
  private state: HubSceneState | null = null
  private ground!: Phaser.GameObjects.Graphics
  private art: Phaser.GameObjects.RenderTexture | null = null
  private markers!: Phaser.GameObjects.Graphics
  private fx!: Phaser.GameObjects.Graphics
  private ambient: Ambient[] = []
  private clouds: { x: number; y: number; w: number; speed: number }[] = []
  private elapsed = 0
  private dpr = 1
  private hasArt = false

  constructor() {
    super('hub')
  }

  preload(): void {
    this.load.image(TILES, tilesUrl)
    this.load.image(BUILDINGS, buildingsUrl)
  }

  /** Names every frame of an atlas the scene loaded; false when it didn't load. */
  private addFrames(key: string, frames: Frames): boolean {
    if (!this.textures.exists(key)) return false
    const texture = this.textures.get(key)
    for (const [id, f] of Object.entries(frames)) if (!texture.has(id)) texture.add(id, 0, f.x, f.y, f.w, f.h)
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    return true
  }

  create(): void {
    this.hasArt = this.addFrames(TILES, TILE_FRAMES) && this.addFrames(BUILDINGS, BUILDING_FRAMES)
    this.ground = this.add.graphics()
    this.markers = this.add.graphics()
    this.fx = this.add.graphics()
    this.cameras.main.setOrigin(0, 0)
    this.redraw()
  }

  /** World size in CSS px. */
  private size(): { w: number; h: number } {
    return { w: this.scale.width / this.dpr, h: this.scale.height / this.dpr }
  }

  /** Takes a new state; a page change fades through black (uma-rpg's camera fade), unless motion is reduced. */
  configure(state: HubSceneState, dpr: number, fade: boolean): void {
    const pageChanged = this.state !== null && this.state.page !== state.page
    this.state = state
    this.dpr = dpr
    if (!this.ground) return
    if (pageChanged && fade && !state.reducedMotion) {
      this.cameras.main.fadeOut(90, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.redraw()
        this.cameras.main.fadeIn(130, 0, 0, 0)
      })
    } else {
      this.redraw()
    }
  }

  redraw(): void {
    if (!this.state || !this.ground) return
    const { page, places } = this.state
    const palette = PALETTES[page]
    const { w, h } = this.size()
    this.cameras.main.setZoom(this.dpr)
    this.cameras.main.setBackgroundColor(palette.background)
    const g = this.ground
    g.clear()
    this.markers.clear()
    this.ambient = []
    const seed = page.length * 31 + page.charCodeAt(0)
    this.clouds = [0, 1, 2].map((i) => ({ x: hash(i, 7, seed) * w, y: (0.15 + i * 0.32) * h, w: 70 + i * 24, speed: 4 + i * 2 }))
    this.art?.destroy()
    this.art = null
    if (this.hasArt) {
      this.drawArt(w, h)
      this.drawFx()
      return
    }
    for (let ty = 0; ty * TILE < h; ty++)
      for (let tx = 0; tx * TILE < w; tx++) {
        const r = hash(tx, ty, seed)
        g.fillStyle(palette.ground[Math.floor(r * palette.ground.length)] ?? palette.ground[0] ?? 0, 1)
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE)
        if (r > 0.86) {
          g.fillStyle(0xffffff, 0.04)
          g.fillRect(tx * TILE + 6, ty * TILE + 8, 4, 4)
        }
      }
    // A road down the middle, as the tiles lay it.
    g.fillStyle(palette.feature, 0.55)
    g.fillRect(w / 2 - 9, 0, 18, h)
    const grid = hubGrid(w, h, this.dpr)
    for (const place of places) {
      const anchor = placeAnchor(place.at, grid)
      this.ambient.push(...drawMarker(this.markers, place.frame, anchor.x, anchor.y - MARKER_BASE, palette))
    }
  }

  /** Terrain, props and buildings, stamped once in art pixels into one texture and scaled up crisp. */
  private drawArt(w: number, h: number): void {
    const { page, places, clearings } = this.state!
    const grid = hubGrid(w, h, this.dpr)
    const terrain = layTerrain(page, tilePageFor(page, TILE_FRAMES), places, grid.cols, grid.rows, clearings)
    const rt = this.add.renderTexture(-grid.left, 0, grid.cols * ART_TILE, grid.rows * ART_TILE).setOrigin(0, 0).setScale(grid.scale).setDepth(-1)
    // Before drawing: under WebGL, changing a render texture's filter rebuilds it empty.
    rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
    const topLeft = { originX: 0, originY: 0 }
    terrain.cells.forEach((frame, i) => rt.stamp(TILES, frame, (i % grid.cols) * ART_TILE, Math.floor(i / grid.cols) * ART_TILE, topLeft))
    // Props and buildings by the row they stand on, so nearer ones overlap farther ones.
    const drawn = places.filter((p) => BUILDING_FRAMES[p.frame] !== undefined && terrain.footprints[p.id] !== undefined)
    const sprites = [
      ...terrain.props.map((p) => ({ row: p.row, key: TILES, frame: p.frame, x: p.col * ART_TILE, y: (p.tall ? p.row - 1 : p.row) * ART_TILE })),
      ...drawn.map((p) => {
        const { col, row } = terrain.footprints[p.id]!
        return { row: row + 0.5, key: BUILDINGS, frame: p.frame, x: (col - 1) * ART_TILE, y: (row - 2) * ART_TILE }
      }),
    ].sort((a, b) => a.row - b.row)
    for (const s of sprites) {
      rt.stamp(s.key, s.frame, s.x, s.y, topLeft)
      const smoke = s.key === BUILDINGS ? BUILDING_FRAMES[s.frame]?.smoke : undefined
      if (smoke) this.ambient.push({ kind: 'smoke', x: (s.x + smoke.x) * grid.scale - grid.left, y: (s.y + smoke.y) * grid.scale })
    }
    rt.render()
    this.art = rt
    // A frame the pinned atlas doesn't draw yet: its code placeholder, standing on the same ground line.
    for (const place of places) {
      if (BUILDING_FRAMES[place.frame] !== undefined) continue
      const anchor = placeAnchor(place.at, grid)
      this.ambient.push(...drawMarker(this.markers, place.frame, anchor.x, anchor.y - MARKER_BASE, PALETTES[page]))
    }
  }

  private drawFx(): void {
    const fx = this.fx
    fx.clear()
    const t = this.elapsed / 1000
    const { w } = this.size()
    for (const c of this.clouds) {
      const x = ((c.x + t * c.speed) % (w + c.w * 2)) - c.w
      fx.fillStyle(0xffffff, 0.05)
      fx.fillEllipse(x, c.y, c.w, c.w * 0.32)
      fx.fillEllipse(x + c.w * 0.25, c.y - c.w * 0.08, c.w * 0.6, c.w * 0.26)
    }
    for (const a of this.ambient) {
      if (a.kind === 'shimmer') {
        for (let i = 0; i < 3; i++) {
          const phase = Math.sin(t * 2.2 + i * 2.1)
          fx.fillStyle(a.color, 0.25 + 0.25 * phase)
          fx.fillRect(a.x - a.w / 2 + ((i * 13 + t * 6) % a.w), a.y - 4 + i * 4, 6, 1.5)
        }
      } else if (a.kind === 'sway') {
        const dx = Math.sin(t * 1.6 + a.y) * 1.2
        fx.fillStyle(a.color, 0.9)
        for (let k = 0; k < 6; k++) fx.fillRect(a.x - a.w / 2 + 2 + k * 8 + dx, a.y - 4, 2, 3)
      } else if (a.kind === 'smoke') {
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.5 + i / 3) % 1
          fx.fillStyle(0xd8d8d8, 0.35 * (1 - p))
          fx.fillCircle(a.x + Math.sin(p * 6 + i) * 3, a.y - p * 20, 2.5 + p * 4)
        }
      } else {
        fx.fillStyle(a.color, 0.18 + 0.1 * Math.sin(t * 1.8))
        fx.fillEllipse(a.x, a.y, a.r * 2.4, a.r * 1.2)
      }
    }
  }

  override update(_time: number, delta: number): void {
    if (!this.state || this.state.reducedMotion) return
    this.elapsed += delta
    this.drawFx()
  }
}
