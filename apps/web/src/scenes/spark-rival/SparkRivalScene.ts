// Pixi touch presentation for Spark Rival Circuit (docs/design/minigames.md#spark-match--rival-circuit).
import {
  SPARK_RIVAL_BOARD_HEIGHT,
  SPARK_RIVAL_BOARD_WIDTH,
  SPARK_RIVAL_MOVEMENT_MS,
  applySparkPath,
  createSparkRivalState,
  currentSparkRivalIntent,
  reduceSparkRival,
  sparkRivalStateHash,
  sparkIndexCell,
  type SparkOrb,
  type SparkPresentationStep,
  type SparkRivalAction,
  type SparkRivalEncounterV1,
  type SparkRivalResolution,
  type SparkRivalState,
  type Strategy,
} from '@racer/domain'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { SparkRunView } from '../../game/minigame-journal'
import type { ContentAsset } from '../../content/runtime'
import { SparkDragController } from './controller'
import {
  SPARK_EFFECT_CAPACITY,
  SPARK_LABEL_CAPACITY,
  sparkAttackLabel,
  sparkIntentAnnouncement,
  sparkResolutionAnnouncement,
} from './feedback'
import { sparkCellAtPoint, type SparkBoardGeometry } from './pointer'
import { SPARK_ORB_GLYPHS, SPARK_ORB_PIXI_COLORS } from '../../ui/minigames/spark-rival-presentation'

const INK = 0x101a24
const FINGER_OFFSET = 18
const ART_TEXTURE_SIZE = 256

export type SparkSceneArt = string | ContentAsset | null

const artKey = (source: Exclude<SparkSceneArt, null>): string => typeof source === 'string'
  ? `chibi:${source}`
  : `atlas:${source.url}:${source.frame.x}:${source.frame.y}`

async function decodeArtTexture(source: Exclude<SparkSceneArt, null>): Promise<Texture | null> {
  try {
    const image = new Image()
    image.src = typeof source === 'string' ? source : source.url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = ART_TEXTURE_SIZE
    canvas.height = ART_TEXTURE_SIZE
    const context = canvas.getContext('2d')
    if (!context) return null
    if (typeof source === 'string') {
      const scale = Math.min(ART_TEXTURE_SIZE / image.naturalWidth, ART_TEXTURE_SIZE / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      context.drawImage(image, (ART_TEXTURE_SIZE - width) / 2, (ART_TEXTURE_SIZE - height) / 2, width, height)
    } else {
      context.drawImage(image, source.frame.x, source.frame.y, source.frame.width, source.frame.height, 0, 0, ART_TEXTURE_SIZE, ART_TEXTURE_SIZE)
    }
    return Texture.from(canvas)
  } catch {
    return null
  }
}

interface OrbToken {
  root: Container
  body: Graphics
  art: Sprite
  shine: Sprite
  badge: Graphics
  glyph: Text
}

interface EffectToken {
  graphic: Graphics
  active: boolean
  vx: number
  vy: number
  life: number
}

interface LabelToken {
  text: Text
  active: boolean
  life: number
}

interface DeltaWaiter {
  remaining: number
  resolve: () => void
}

export interface SparkRivalHud {
  wave: number
  waveTurn: number
  resolve: number
  maxResolve: number
  drive: number
  maxDrive: number
  sparkCharge: number
  sparkTarget: number
  countdown: number
  intent: string
  rivalLabel: string
  rivalStrategy: Strategy
  dragging: boolean
  movementRemainingMs: number | null
  inputLocked: boolean
  outcome: string | null
  status: string
  announcement: string
  announcementSerial: number
  recoveryNeeded: boolean
  debug: {
    boardSprites: string
    activeEffects: number
    effectCapacity: number
    activeLabels: number
    labelCapacity: number
    fps: number
    frameMs: number
    actionCount: number
    stateHash: string
    paused: boolean
    pointerMoveReactUpdates: 0
    ignoredPointers: number
  }
}

export interface SparkRivalSceneOptions {
  encounter: SparkRivalEncounterV1
  seed: string
  actions?: readonly SparkRivalAction[]
  append?: (expectedActionCount: number, action: SparkRivalAction) => Promise<SparkRunView>
  restore?: () => Promise<SparkRunView>
  onTerminal?: (view: SparkRunView) => void
}

export class SparkRivalScene {
  private readonly app = new Application()
  protected readonly encounter: SparkRivalEncounterV1
  protected readonly seed: string
  protected readonly controller = new SparkDragController()
  private readonly background = new Graphics()
  private readonly rivalLayer = new Container()
  private readonly rivalCard = new Graphics()
  private readonly rivalMark = new Graphics()
  private readonly rivalArt = new Sprite(Texture.EMPTY)
  private readonly rivalGlyph = new Text({
    text: 'R',
    style: { fontFamily: 'Outfit, system-ui, sans-serif', fontSize: 36, fontWeight: '800', fill: 0xffffff },
  })
  private readonly boardPlate = new Graphics()
  private readonly boardLayer = new Container()
  private readonly effectLayer = new Container()
  private readonly tokens: OrbToken[] = []
  private readonly tokenTargets: { x: number; y: number }[] = []
  private readonly effects: EffectToken[] = []
  private readonly labels: LabelToken[] = []
  private readonly waiters: DeltaWaiter[] = []
  protected geometry: SparkBoardGeometry = { left: 0, top: 0, cellSize: 1 }
  protected state: SparkRivalState
  protected previewBoard: readonly SparkOrb[]
  protected actionCount: number
  protected inputLocked = false
  private destroyed = false
  private mounted = false
  private reducedMotion = false
  protected status = 'Drag an orb through several cells. The clock starts when it moves.'
  protected pointerX = 0
  protected pointerY = 0
  protected heldIndex: number | null = null
  private ignoredPointers = 0
  private hudElapsed = 0
  private lastFrameMs = 0
  private lastWidth = 0
  private lastHeight = 0
  private rivalPulse = 0
  private announcement = ''
  private announcementSerial = 0
  private recoveryNeeded = false
  private paused = false
  private artVersion = 0
  private orbTextures: Partial<Record<SparkOrb, Texture>> = {}
  private rivalTextures: Readonly<Record<string, Texture>> = {}
  private ownedArtTextures: Texture[] = []

  private readonly options: SparkRivalSceneOptions

  constructor(private readonly onHud: (hud: SparkRivalHud) => void, options: SparkRivalSceneOptions) {
    this.options = options
    this.encounter = options.encounter
    this.seed = options.seed
    const replay = options.actions
      ? options.actions.reduce(
          (current, action, index) => reduceSparkRival(this.encounter, current, action, index).state,
          createSparkRivalState(this.encounter, this.seed),
        )
      : createSparkRivalState(this.encounter, this.seed)
    this.state = replay
    this.previewBoard = replay.board
    this.actionCount = options.actions?.length ?? 0
    this.rivalArt.anchor.set(0.5)
    this.rivalGlyph.anchor.set(0.5)
    this.rivalLayer.addChild(this.rivalCard, this.rivalMark, this.rivalArt, this.rivalGlyph)
  }

  async mount(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      preference: 'webgl',
    })
    if (this.destroyed) {
      this.app.destroy({ removeView: true }, { children: true })
      return
    }
    this.mounted = true
    host.appendChild(this.app.canvas)
    this.app.canvas.style.touchAction = 'none'
    this.app.canvas.style.display = 'block'
    this.app.canvas.setAttribute('role', 'img')
    this.app.canvas.setAttribute('aria-label', 'Touch-only Spark Rival six by five orb board. Use Matchups for the strategy legend.')
    this.app.stage.sortableChildren = true
    this.app.stage.addChild(this.background, this.rivalLayer, this.boardPlate, this.boardLayer, this.effectLayer)
    this.buildPool()
    this.layout(true)
    this.renderBoard(this.state.board)
    this.bindPointerEvents()
    this.app.ticker.add(this.update)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.announceWave()
    this.emitHud()
  }

  destroy(): void {
    this.destroyed = true
    this.artVersion += 1
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.mounted) this.unbindPointerEvents()
    for (const waiter of this.waiters.splice(0)) waiter.resolve()
    if (this.mounted) this.app.destroy({ removeView: true }, { children: true })
    for (const texture of this.ownedArtTextures) texture.destroy(true)
    this.ownedArtTextures.length = 0
  }

  /** Private Chibis are decoded into owned Pixi textures; missing art leaves the glyph fallback. */
  async setArt(
    orbs: Partial<Record<SparkOrb, SparkSceneArt>>,
    rivals: Readonly<Record<string, SparkSceneArt>>,
  ): Promise<void> {
    const version = ++this.artVersion
    const sources = [...Object.values(orbs), ...Object.values(rivals)].filter((source): source is Exclude<SparkSceneArt, null> => Boolean(source))
    const unique = [...new Map(sources.map((source) => [artKey(source), source])).entries()]
    const decoded = await Promise.all(unique.map(async ([key, source]) => [key, await decodeArtTexture(source)] as const))
    const textures = decoded.flatMap(([, texture]) => texture ? [texture] : [])
    if (this.destroyed || version !== this.artVersion) {
      for (const texture of textures) texture.destroy(true)
      return
    }
    for (const texture of this.ownedArtTextures) texture.destroy(true)
    this.ownedArtTextures = textures
    const bySource = new Map(decoded)
    this.orbTextures = Object.fromEntries(Object.entries(orbs).flatMap(([orb, source]) => {
      const texture = source ? bySource.get(artKey(source)) : null
      return texture ? [[orb, texture]] : []
    }))
    this.rivalTextures = Object.fromEntries(Object.entries(rivals).flatMap(([id, source]) => {
      const texture = source ? bySource.get(artKey(source)) : null
      return texture ? [[id, texture]] : []
    }))
    if (this.tokens.length > 0) this.renderBoard(this.previewBoard, this.heldIndex)
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value
  }

  triggerShift(): void {
    if (this.inputLocked || this.controller.snapshot) return
    void this.resolveAction({ type: 'spark-shift' })
  }

  retryRestore(): void {
    if (!this.recoveryNeeded || !this.options.restore) return
    void this.restoreBoundary('Retrying the saved run…')
  }

  private buildPool(): void {
    for (let index = 0; index < 30; index += 1) {
      const root = new Container()
      const body = new Graphics()
      const art = new Sprite(Texture.EMPTY)
      art.anchor.set(0.5)
      art.visible = false
      const shine = new Sprite(Texture.WHITE)
      shine.anchor.set(0.5)
      shine.rotation = Math.PI / 4
      shine.alpha = 0.22
      const badge = new Graphics()
      const glyph = new Text({
        text: '',
        style: { fontFamily: 'Outfit, system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: 0xffffff, stroke: { color: INK, width: 3 } },
      })
      glyph.anchor.set(0.5)
      root.addChild(body, art, badge, shine, glyph)
      this.boardLayer.addChild(root)
      this.tokens.push({ root, body, art, shine, badge, glyph })
      this.tokenTargets.push({ x: 0, y: 0 })
    }
    for (let index = 0; index < SPARK_EFFECT_CAPACITY; index += 1) {
      const graphic = new Graphics().circle(0, 0, 4).fill({ color: 0xffffff })
      graphic.visible = false
      this.effectLayer.addChild(graphic)
      this.effects.push({ graphic, active: false, vx: 0, vy: 0, life: 0 })
    }
    for (let index = 0; index < SPARK_LABEL_CAPACITY; index += 1) {
      const label = new Text({
        text: '',
        style: {
          fontFamily: 'Outfit, system-ui, sans-serif',
          fontSize: 20,
          fontWeight: '800',
          fill: 0xffffff,
          stroke: { color: INK, width: 4 },
          align: 'center',
        },
      })
      label.anchor.set(0.5)
      label.visible = false
      this.effectLayer.addChild(label)
      this.labels.push({ text: label, active: false, life: 0 })
    }
  }

  private layout(force = false): void {
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (!force && width === this.lastWidth && height === this.lastHeight) return
    const resized = this.lastWidth > 0 && (width !== this.lastWidth || height !== this.lastHeight)
    this.lastWidth = width
    this.lastHeight = height
    if (resized && this.controller.snapshot) {
      this.controller.cancel()
      this.previewBoard = this.state.board
      this.heldIndex = null
      this.status = 'Layout changed — drag cancelled and no turn was spent.'
      this.announce('Layout changed. Drag cancelled; no turn was spent.')
    }
    const margin = Math.max(10, Math.min(18, width * 0.04))
    const cellSize = Math.floor(Math.min((width - margin * 2) / SPARK_RIVAL_BOARD_WIDTH, (height - 94 - margin * 2) / SPARK_RIVAL_BOARD_HEIGHT))
    const boardWidth = cellSize * SPARK_RIVAL_BOARD_WIDTH
    const boardHeight = cellSize * SPARK_RIVAL_BOARD_HEIGHT
    const left = Math.round((width - boardWidth) / 2)
    const top = Math.max(84, Math.round(height - boardHeight - margin))
    this.geometry = { left, top, cellSize }

    this.background.clear()
      .rect(0, 0, width, height).fill({ color: 0x101a24 })
      .circle(width * 0.14, height * 0.14, width * 0.36).fill({ color: 0x2f6fe0, alpha: 0.09 })
      .circle(width * 0.88, height * 0.28, width * 0.42).fill({ color: 0xd39a2b, alpha: 0.07 })
    this.boardPlate.clear()
      .roundRect(left - 5, top - 5, boardWidth + 10, boardHeight + 10, 18)
      .fill({ color: 0x0b121a, alpha: 0.96 })
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.12 })

    const rivalX = width / 2
    const rivalY = Math.max(42, top / 2)
    this.rivalLayer.position.set(rivalX, rivalY)
    this.rivalCard.clear().roundRect(-76, -35, 152, 70, 20)
      .fill({ color: 0x172838, alpha: 0.98 }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.14 })
    this.rivalArt.width = 62
    this.rivalArt.height = 62
    this.rivalGlyph.position.set(0, 1)

    for (let index = 0; index < this.tokens.length; index += 1) {
      const token = this.tokens[index]!
      const radius = cellSize * 0.4
      token.art.width = radius * 1.75
      token.art.height = radius * 1.75
      this.placeToken(index, true)
    }
    this.renderBoard(this.previewBoard, this.heldIndex)
  }

  private placeToken(index: number, snap = false): void {
    const cell = sparkIndexCell(index)
    const x = this.geometry.left + (cell.column + 0.5) * this.geometry.cellSize
    const y = this.geometry.top + (cell.row + 0.5) * this.geometry.cellSize
    const target = this.tokenTargets[index]!
    target.x = x
    target.y = y
    if (snap) this.tokens[index]!.root.position.set(x, y)
  }

  protected renderBoard(
    board: readonly SparkOrb[],
    heldIndex: number | null = null,
    displaced?: { tokenIndex: number; fromIndex: number },
  ): void {
    this.heldIndex = heldIndex
    for (let index = 0; index < this.tokens.length; index += 1) {
      const orb = board[index]!
      const token = this.tokens[index]!
      const radius = this.geometry.cellSize * 0.4
      const color = SPARK_ORB_PIXI_COLORS[orb]
      const texture = this.orbTextures[orb]
      const hasArt = texture !== undefined
      token.body.clear().circle(0, 0, radius)
        .fill({ color, alpha: 0.24 })
        .stroke({ width: Math.max(3, this.geometry.cellSize * 0.055), color: index === heldIndex ? 0xffffff : color, alpha: 1 })
      token.art.visible = hasArt
      if (texture) token.art.texture = texture
      token.art.width = radius * 1.75
      token.art.height = radius * 1.75
      token.badge.clear()
      token.shine.visible = orb === 'spark'
      token.shine.tint = 0xffffff
      token.shine.alpha = 0.9
      token.glyph.text = SPARK_ORB_GLYPHS[orb]
      if (hasArt) {
        const badgeX = radius * 0.58
        const badgeY = radius * 0.58
        token.badge.circle(badgeX, badgeY, radius * 0.27).fill({ color: INK, alpha: 0.92 }).stroke({ width: 1.2, color: 0xffffff, alpha: 0.82 })
        token.glyph.position.set(badgeX, badgeY)
        token.glyph.style.fontSize = Math.max(11, Math.round(this.geometry.cellSize * 0.2))
        token.shine.position.set(badgeX, badgeY)
        token.shine.width = radius * 0.25
        token.shine.height = radius * 0.25
      } else {
        token.glyph.position.set(0, 0)
        token.glyph.style.fontSize = Math.max(18, Math.round(this.geometry.cellSize * 0.42))
        token.shine.position.set(0, 0)
        token.shine.width = radius * 0.82
        token.shine.height = radius * 0.82
      }
      token.root.visible = true
      token.root.alpha = 1
      token.root.scale.set(index === heldIndex ? 1.12 : 1)
      token.root.zIndex = index === heldIndex ? 10 : 0
      if (index === heldIndex) token.root.position.set(this.pointerX, this.pointerY - FINGER_OFFSET)
      else this.placeToken(index)
    }
    if (displaced) {
      const origin = this.tokenTargets[displaced.fromIndex]!
      this.tokens[displaced.tokenIndex]!.root.position.set(origin.x, origin.y)
    }
    this.boardLayer.sortableChildren = true
    this.boardLayer.sortChildren()
    this.renderRival()
  }

  private renderRival(): void {
    const strategy = this.state.rival.strategy
    const color = SPARK_ORB_PIXI_COLORS[strategy]
    const texture = this.rivalTextures[this.encounter.waves[this.state.waveIndex]!.id]
    const boss = this.state.waveIndex === this.encounter.waves.length - 1
    this.rivalCard.clear().roundRect(-76, -35, 152, 70, 20)
      .fill({ color: boss ? 0x2c2518 : 0x172838, alpha: 0.98 })
      .stroke({ width: boss ? 2.5 : 1.5, color: boss ? 0xf2bd55 : 0xffffff, alpha: boss ? 0.82 : 0.14 })
    this.rivalMark.clear().circle(0, 0, 31).fill({ color, alpha: 0.24 }).stroke({ width: 4, color })
    this.rivalArt.visible = texture !== undefined
    if (texture) this.rivalArt.texture = texture
    this.rivalGlyph.visible = texture === undefined
    this.rivalGlyph.text = SPARK_ORB_GLYPHS[strategy]
  }

  private bindPointerEvents(): void {
    const canvas = this.app.canvas
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
    canvas.addEventListener('lostpointercapture', this.onLostCapture)
  }

  private unbindPointerEvents(): void {
    const canvas = this.app.canvas
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerCancel)
    canvas.removeEventListener('lostpointercapture', this.onLostCapture)
  }

  private localPoint(event: PointerEvent): { x: number; y: number } {
    const bounds = this.app.canvas.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * this.app.screen.width / bounds.width,
      y: (event.clientY - bounds.top) * this.app.screen.height / bounds.height,
    }
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.inputLocked || this.state.outcome) return
    if (this.controller.snapshot) {
      this.ignoredPointers += 1
      this.emitHud()
      return
    }
    const point = this.localPoint(event)
    const cell = sparkCellAtPoint(point.x, point.y, this.geometry)
    if (!cell || !this.controller.begin(event.pointerId, cell)) return
    event.preventDefault()
    this.app.canvas.setPointerCapture(event.pointerId)
    this.pointerX = point.x
    this.pointerY = point.y
    this.previewBoard = this.state.board
    this.status = 'Planning is free. Cross the first cell to start seven seconds.'
    this.renderBoard(this.previewBoard, cell.row * SPARK_RIVAL_BOARD_WIDTH + cell.column)
    this.emitHud()
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const active = this.controller.snapshot
    if (!active || active.pointerId !== event.pointerId || this.inputLocked) return
    const point = this.localPoint(event)
    const cell = sparkCellAtPoint(point.x, point.y, this.geometry)
    this.pointerX = point.x
    this.pointerY = point.y
    if (!cell) {
      const held = active.path.at(-1)!
      this.renderBoard(this.previewBoard, held.row * SPARK_RIVAL_BOARD_WIDTH + held.column)
      return
    }
    const moved = this.controller.move(event.pointerId, cell, performance.now())
    let displaced: { tokenIndex: number; fromIndex: number } | undefined
    if (moved.changed) {
      const path = this.controller.snapshot!.path
      this.previewBoard = applySparkPath(this.state.board, path)
      this.status = 'Movement clock running — release to resolve.'
      const previous = path.at(-2)!
      const current = path.at(-1)!
      displaced = {
        tokenIndex: previous.row * SPARK_RIVAL_BOARD_WIDTH + previous.column,
        fromIndex: current.row * SPARK_RIVAL_BOARD_WIDTH + current.column,
      }
    }
    const held = this.controller.snapshot!.path.at(-1)!
    this.renderBoard(this.previewBoard, held.row * SPARK_RIVAL_BOARD_WIDTH + held.column, displaced)
    if (moved.resolveNow) void this.finishPointer(event.pointerId, performance.now())
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.controller.snapshot?.pointerId !== event.pointerId) return
    event.preventDefault()
    void this.finishPointer(event.pointerId, performance.now())
  }

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.cancelPointer(event.pointerId, 'Drag cancelled — the untouched engine state was restored.')
  }

  private readonly onLostCapture = (event: PointerEvent): void => {
    if (this.controller.snapshot?.pointerId === event.pointerId) this.cancelPointer(event.pointerId, 'Pointer capture was lost; no turn was spent.')
  }

  private cancelPointer(pointerId: number, message: string): void {
    if (!this.controller.cancel(pointerId)) return
    this.previewBoard = this.state.board
    this.status = message
    this.renderBoard(this.state.board)
    this.emitHud()
  }

  private async finishPointer(pointerId: number, now: number): Promise<void> {
    const action = this.controller.release(pointerId, now)
    if (this.app.canvas.hasPointerCapture(pointerId)) this.app.canvas.releasePointerCapture(pointerId)
    if (!action) {
      this.previewBoard = this.state.board
      this.status = 'Move through at least one neighboring cell to spend a turn.'
      this.renderBoard(this.state.board)
      this.emitHud()
      return
    }
    await this.resolveAction(action)
  }

  protected async resolveAction(action: SparkRivalAction): Promise<void> {
    if (this.inputLocked || this.state.outcome) return
    this.inputLocked = true
    try {
      const priorWave = this.state.waveIndex
      const expected = this.actionCount
      const reduced = this.options.append
        ? await this.options.append(expected, action)
        : null
      const local = reduced ? null : reduceSparkRival(this.encounter, this.state, action, expected)
      const resolution = reduced?.replay.turns[expected] ?? local!.resolution
      const finalState = reduced?.replay.state ?? local!.state
      this.status = resolution.combos === 0 ? 'No match — the rival still advances.' : `${resolution.combos} combo${resolution.combos === 1 ? '' : 's'}!`
      this.emitHud()
      await this.animateResolution(resolution, finalState)
      if (this.destroyed) return
      this.state = finalState
      this.previewBoard = finalState.board
      this.actionCount = reduced?.actions.length ?? expected + 1
      this.recoveryNeeded = false
      this.renderBoard(finalState.board)
      if (!finalState.outcome && finalState.waveIndex !== priorWave) {
        const boss = finalState.waveIndex === this.encounter.waves.length - 1
        this.status = `${boss ? 'Circuit boss' : `Wave ${finalState.waveIndex + 1}`} · ${this.encounter.waves[finalState.waveIndex]!.label}`
        this.showLabel(boss ? 'CIRCUIT BOSS' : `WAVE ${finalState.waveIndex + 1}`, 0xf2bd55, this.rivalLayer.x, this.rivalLayer.y + 42)
        this.emitHud()
        await this.wait(this.reducedMotion ? 60 : 300)
        if (this.destroyed) return
      }
      this.inputLocked = false
      this.status = finalState.outcome
        ? finalState.outcome.kind === 'clear' ? `Circuit cleared · ${finalState.outcome.trainingExp} EXP` : `Run lost · ${finalState.outcome.trainingExp} EXP banked`
        : 'Your move. The board and gauges are ready.'
      const turnAnnouncement = sparkResolutionAnnouncement(resolution, finalState)
      this.announce(finalState.outcome ? turnAnnouncement : `${turnAnnouncement} ${this.readyAnnouncement()}`)
      this.emitHud()
      if (reduced?.replay.outcome) this.options.onTerminal?.(reduced)
    } catch (error) {
      let restoredBoundary = false
      try {
        const restored = await this.options.restore?.()
        if (restored) {
          this.state = restored.replay.state
          this.previewBoard = restored.replay.state.board
          this.actionCount = restored.actions.length
          restoredBoundary = true
          if (restored.replay.outcome) this.options.onTerminal?.(restored)
        }
      } catch {
        // Keep the last authoritative boundary visible if reload is also unavailable.
      }
      this.controller.cancel()
      this.inputLocked = !restoredBoundary
      this.recoveryNeeded = !restoredBoundary
      this.renderBoard(this.state.board)
      this.status = restoredBoundary
        ? `${error instanceof Error ? error.message : 'Action could not be saved'} · restored saved run.`
        : `${error instanceof Error ? error.message : 'Action could not be saved'} · use Retry or Return.`
      this.announce(restoredBoundary ? 'Action was not saved. The last saved turn was restored.' : 'The saved run could not be restored. Use Retry or Return.')
      this.emitHud()
    }
  }

  private async animateResolution(resolution: SparkRivalResolution, finalState: SparkRivalState): Promise<void> {
    if (resolution.action.type === 'spark-shift') {
      this.renderBoard(finalState.board)
      this.showLabel('SPARK SHIFT', 0xf2bd55, this.app.screen.width / 2, this.rivalLayer.y + 48)
      await this.wait(this.reducedMotion ? 70 : 360)
      return
    }
    if (resolution.cascades.length === 0) {
      this.renderBoard(finalState.board)
      await this.wait(this.reducedMotion ? 50 : 220)
    }
    for (const cascade of resolution.cascades) {
      this.renderBoard(cascade.before)
      if (cascade.index === 0) this.showLabel(`${resolution.combos} COMBO${resolution.combos === 1 ? '' : 'S'}`, 0xffffff, this.app.screen.width / 2, this.geometry.top - 16)
      for (const group of cascade.groups) for (const index of group.indices) {
        const token = this.tokens[index]!
        token.body.circle(0, 0, this.geometry.cellSize * 0.44).stroke({ width: 4, color: 0xffffff, alpha: 0.95 })
      }
      this.status = cascade.index === 0 ? `${resolution.combos} combo${resolution.combos === 1 ? '' : 's'} ready` : `Cascade ${cascade.index + 1} ready`
      this.emitHud()
      await this.wait(this.reducedMotion ? 35 : 120)
      for (const group of cascade.groups) for (const index of group.indices) {
        this.tokens[index]!.root.alpha = 0.28
        this.burst(index, SPARK_ORB_PIXI_COLORS[group.orb])
      }
      this.status = cascade.index === 0 ? `${resolution.combos} combo clear` : `Cascade ${cascade.index + 1}`
      this.emitHud()
      await this.wait(this.reducedMotion ? 60 : 680)
      this.renderBoard(cascade.after)
      await this.wait(this.reducedMotion ? 45 : 360)
    }
    for (const step of resolution.steps) await this.animateCombatStep(step)
  }

  private async animateCombatStep(step: SparkPresentationStep): Promise<void> {
    if (step.type === 'attack' && step.attack.appliedAmount > 0) {
      this.rivalPulse = 1
      const matchup = step.attack.matchup === 'advantaged' ? ' · Weak' : step.attack.matchup === 'resisted' ? ' · Resist' : ''
      this.status = `${step.attack.orb === 'spark' ? 'Spark' : step.attack.orb} hit · ${step.attack.appliedAmount} Resolve${matchup}`
      this.showLabel(sparkAttackLabel(step.attack), SPARK_ORB_PIXI_COLORS[step.attack.orb], this.rivalLayer.x, this.rivalLayer.y)
      this.attackTrail(SPARK_ORB_PIXI_COLORS[step.attack.orb])
      this.impact(this.rivalLayer.x, this.rivalLayer.y, SPARK_ORB_PIXI_COLORS[step.attack.orb])
      this.emitHud()
      await this.wait(this.reducedMotion ? 45 : 230)
    } else if (step.type === 'recovery' && step.amount > 0) {
      this.status = `${step.amount} Drive recovered`
      this.showLabel(`+${step.amount} DRIVE`, 0x39c78b, this.app.screen.width * 0.25, this.rivalLayer.y)
      this.emitHud()
      await this.wait(this.reducedMotion ? 40 : 180)
    } else if (step.type === 'charge' && step.amount > 0) {
      this.status = `${step.amount} Spark charged`
      this.showLabel(`+${step.amount} SPARK`, 0xf2bd55, this.app.screen.width * 0.75, this.rivalLayer.y)
      this.emitHud()
      await this.wait(this.reducedMotion ? 40 : 180)
    } else if (step.type === 'rival-intent') {
      this.status = sparkIntentAnnouncement(step.intent, step.driveBefore, step.driveAfter, step.converted.length)
      this.showLabel(step.intent.type.toUpperCase().replace('-', ' '), 0xff7a6f, this.rivalLayer.x, this.rivalLayer.y + 8)
      if (step.intent.type === 'pressure') this.impact(this.app.screen.width / 2, this.geometry.top - 20, 0xff7a6f)
      if (step.intent.type === 'convert') this.renderBoard(step.boardAfter)
      this.emitHud()
      await this.wait(this.reducedMotion ? 45 : 240)
    } else if (step.type === 'wave-clear') {
      this.status = `Wave ${step.wave} cleared`
      this.showLabel(`WAVE ${step.wave} CLEAR`, 0xf2bd55, this.rivalLayer.x, this.rivalLayer.y)
      this.emitHud()
      await this.wait(this.reducedMotion ? 80 : 420)
    }
  }

  private showLabel(message: string, color: number, x: number, y: number): void {
    const token = this.labels.find((candidate) => !candidate.active)
    if (!token) return
    token.active = true
    token.life = 760
    token.text.text = message
    token.text.style.fill = color
    token.text.alpha = 1
    token.text.position.set(x, y)
    token.text.visible = true
  }

  private impact(x: number, y: number, color: number): void {
    if (this.reducedMotion) return
    for (let count = 0; count < 6; count += 1) {
      const token = this.effects.find((effect) => !effect.active)
      if (!token) return
      const angle = count * Math.PI / 3
      token.active = true
      token.life = 420
      token.vx = Math.cos(angle) * 0.09
      token.vy = Math.sin(angle) * 0.09
      token.graphic.tint = color
      token.graphic.alpha = 0.95
      token.graphic.position.set(x, y)
      token.graphic.visible = true
    }
  }

  private attackTrail(color: number): void {
    if (this.reducedMotion) return
    const startY = this.geometry.top - 4
    const distance = Math.max(1, startY - this.rivalLayer.y)
    for (let count = 0; count < 4; count += 1) {
      const token = this.effects.find((effect) => !effect.active)
      if (!token) return
      token.active = true
      token.life = 420
      token.vx = (count - 1.5) * 0.01
      token.vy = -distance / 420
      token.graphic.tint = color
      token.graphic.alpha = 0.9
      token.graphic.position.set(this.app.screen.width / 2, startY + count * 5)
      token.graphic.visible = true
    }
  }

  private burst(index: number, color: number): void {
    if (this.reducedMotion) return
    const cell = sparkIndexCell(index)
    const centerX = this.geometry.left + (cell.column + 0.5) * this.geometry.cellSize
    const centerY = this.geometry.top + (cell.row + 0.5) * this.geometry.cellSize
    for (let count = 0; count < 3; count += 1) {
      const token = this.effects.find((effect) => !effect.active)
      if (!token) return
      const angle = ((index * 5 + count * 7) % 18) * Math.PI / 9
      token.active = true
      token.life = 420
      token.vx = Math.cos(angle) * (0.035 + count * 0.012)
      token.vy = Math.sin(angle) * (0.035 + count * 0.012) - 0.025
      token.graphic.tint = color
      token.graphic.alpha = 0.9
      token.graphic.position.set(centerX, centerY)
      token.graphic.visible = true
    }
  }

  private wait(milliseconds: number): Promise<void> {
    if (milliseconds <= 0 || this.destroyed) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push({ remaining: milliseconds, resolve }))
  }

  private readonly update = (ticker: { deltaMS: number; FPS: number }): void => {
    if (this.destroyed) return
    this.layout()
    const deltaMs = Math.min(50, ticker.deltaMS)
    this.lastFrameMs = deltaMs
    for (let index = this.waiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.waiters[index]!
      waiter.remaining -= deltaMs
      if (waiter.remaining <= 0) {
        this.waiters.splice(index, 1)
        waiter.resolve()
      }
    }
    for (const effect of this.effects) {
      if (!effect.active) continue
      effect.life -= deltaMs
      effect.graphic.x += effect.vx * deltaMs
      effect.graphic.y += effect.vy * deltaMs
      effect.graphic.alpha = Math.max(0, effect.life / 420)
      if (effect.life <= 0) {
        effect.active = false
        effect.graphic.visible = false
      }
    }
    for (const label of this.labels) {
      if (!label.active) continue
      label.life -= deltaMs
      label.text.y -= deltaMs * 0.025
      label.text.alpha = Math.max(0, label.life / 760)
      if (label.life <= 0) {
        label.active = false
        label.text.visible = false
      }
    }
    const settle = Math.min(1, deltaMs / (this.reducedMotion ? 16 : 55))
    for (let index = 0; index < this.tokens.length; index += 1) {
      if (index === this.heldIndex) continue
      const root = this.tokens[index]!.root
      const target = this.tokenTargets[index]!
      root.x += (target.x - root.x) * settle
      root.y += (target.y - root.y) * settle
    }
    if (this.rivalPulse > 0) {
      this.rivalPulse = Math.max(0, this.rivalPulse - deltaMs / 180)
      const scale = 1 + this.rivalPulse * 0.08
      this.rivalLayer.scale.set(scale)
      this.rivalLayer.alpha = 1 - this.rivalPulse * 0.25
    } else {
      this.rivalLayer.scale.set(1)
      this.rivalLayer.alpha = 1
    }
    const timedOut = this.controller.timeout(performance.now())
    if (timedOut) {
      this.status = 'Time! Resolving the recorded path.'
      this.emitHud()
      void this.resolveAction(timedOut)
    }
    this.hudElapsed += deltaMs
    if (this.hudElapsed >= 250) {
      this.hudElapsed = 0
      this.emitHud(Math.round(ticker.FPS))
    }
  }

  protected emitHud(fps = Math.round(this.app.ticker.FPS || 0)): void {
    const active = this.controller.snapshot
    const elapsed = active?.movementStartedAt === null || active?.movementStartedAt === undefined
      ? null
      : Math.max(0, SPARK_RIVAL_MOVEMENT_MS - (performance.now() - active.movementStartedAt))
    let intent = '—'
    if (!this.state.outcome) intent = currentSparkRivalIntent(this.encounter, this.state).type.replace('-', ' ')
    this.onHud({
      wave: this.state.waveIndex + 1,
      waveTurn: this.state.waveTurn,
      resolve: this.state.rival.resolve,
      maxResolve: this.state.rival.maxResolve,
      drive: this.state.drive,
      maxDrive: this.state.maxDrive,
      sparkCharge: this.state.sparkCharge,
      sparkTarget: this.state.sparkTarget,
      countdown: this.state.rival.countdown,
      intent,
      rivalLabel: this.encounter.waves[this.state.waveIndex]!.label,
      rivalStrategy: this.state.rival.strategy,
      dragging: active !== null,
      movementRemainingMs: elapsed,
      inputLocked: this.inputLocked,
      outcome: this.state.outcome?.kind ?? null,
      status: this.status,
      announcement: this.announcement,
      announcementSerial: this.announcementSerial,
      recoveryNeeded: this.recoveryNeeded,
      debug: {
        boardSprites: `${this.tokens.length}/30`,
        activeEffects: this.effects.filter((effect) => effect.active).length,
        effectCapacity: this.effects.length,
        activeLabels: this.labels.filter((label) => label.active).length,
        labelCapacity: this.labels.length,
        fps,
        frameMs: Math.round(this.lastFrameMs * 10) / 10,
        actionCount: this.actionCount,
        stateHash: sparkRivalStateHash(this.state),
        paused: this.paused,
        pointerMoveReactUpdates: 0,
        ignoredPointers: this.ignoredPointers,
      },
    })
  }

  private announce(message: string): void {
    if (!message) return
    this.announcement = message
    this.announcementSerial += 1
  }

  private readyAnnouncement(): string {
    if (this.state.outcome) return ''
    const wave = this.encounter.waves[this.state.waveIndex]!
    const intent = currentSparkRivalIntent(this.encounter, this.state)
    return `Wave ${this.state.waveIndex + 1}. ${wave.label}, ${wave.strategy} style. Next rival intent is ${intent.type.replace('-', ' ')} in ${this.state.rival.countdown} turns.`
  }

  private announceWave(): void {
    const message = this.readyAnnouncement()
    if (message) this.announce(message)
  }

  private async restoreBoundary(status: string): Promise<void> {
    if (!this.options.restore) return
    this.inputLocked = true
    this.recoveryNeeded = false
    this.status = status
    this.emitHud()
    try {
      const restored = await this.options.restore()
      if (this.destroyed) return
      this.state = restored.replay.state
      this.previewBoard = restored.replay.state.board
      this.actionCount = restored.actions.length
      this.inputLocked = false
      this.recoveryNeeded = false
      this.renderBoard(this.state.board)
      this.status = restored.replay.outcome ? 'Restored completed circuit.' : 'Saved run restored. Your move.'
      this.announce(restored.replay.outcome ? 'Completed circuit restored.' : 'Saved run restored at the last completed turn.')
      this.app.ticker.start()
      this.emitHud()
      if (restored.replay.outcome) this.options.onTerminal?.(restored)
    } catch (error) {
      if (this.destroyed) return
      this.inputLocked = true
      this.recoveryNeeded = true
      this.status = `${error instanceof Error ? error.message : 'Saved run could not be restored'} · use Retry or Return.`
      this.announce('The saved run could not be restored. Use Retry or Return.')
      this.app.ticker.start()
      this.emitHud()
    }
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      const active = this.controller.snapshot
      if (active) this.cancelPointer(active.pointerId, 'App paused — the live drag was cancelled with no action spent.')
      this.paused = true
      this.emitHud()
      this.app.ticker.stop()
      return
    }
    this.paused = false
    if (!this.options.restore) {
      this.app.ticker.start()
      this.emitHud()
      return
    }
    void this.restoreBoundary('Restoring the saved action boundary…')
  }
}
