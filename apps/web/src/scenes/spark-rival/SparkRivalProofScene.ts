// Development-only Pixi touch proof for Spark Rival Circuit (docs/tasks/T071-spark-rival-engine.md).
import { SPARK_RIVAL_BOARD_HEIGHT, SPARK_RIVAL_BOARD_WIDTH, SPARK_RIVAL_MOVEMENT_MS } from '@racer/domain'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import {
  applySparkPath,
  createSparkRivalState,
  currentSparkRivalIntent,
  reduceSparkRival,
  sparkIndexCell,
  syntheticSparkEncounter,
  type SparkCell,
  type SparkOrb,
  type SparkPresentationStep,
  type SparkRivalAction,
  type SparkRivalEncounterV1,
  type SparkRivalResolution,
  type SparkRivalState,
} from '../../game/minigames/spark-rival'
import { SparkDragController } from './controller'
import { sparkCellAtPoint, type SparkBoardGeometry } from './pointer'

const ORB_COLORS: Record<SparkOrb, number> = {
  front: 0xe05d58,
  pace: 0x4a86e8,
  late: 0x9a68db,
  end: 0x3ab28f,
  spark: 0xf3b53f,
  recovery: 0x58bf70,
}
const ORB_GLYPHS: Record<SparkOrb, string> = {
  front: 'F', pace: 'P', late: 'L', end: 'E', spark: '', recovery: '+',
}
const INK = 0x101a24
const EFFECT_POOL_SIZE = 24
const FINGER_OFFSET = 18

interface OrbToken {
  root: Container
  body: Graphics
  shine: Sprite
  glyph: Text
}

interface EffectToken {
  graphic: Graphics
  active: boolean
  vx: number
  vy: number
  life: number
}

interface DeltaWaiter {
  remaining: number
  resolve: () => void
}

export interface SparkRivalProofHud {
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
  dragging: boolean
  movementRemainingMs: number | null
  inputLocked: boolean
  outcome: string | null
  status: string
  debug: {
    boardSprites: string
    activeEffects: number
    effectCapacity: number
    fps: number
    pointerMoveReactUpdates: 0
    ignoredPointers: number
  }
}

export class SparkRivalProofScene {
  private readonly app = new Application()
  private readonly encounter: SparkRivalEncounterV1 = syntheticSparkEncounter({
    scenarioTier: 7,
    trainingLevel: 5,
    traineeBest: 'pace',
    recipes: ['rush-pressure', 'surge-convert', 'circuit-boss'],
  })
  private readonly controller = new SparkDragController()
  private readonly background = new Graphics()
  private readonly rivalLayer = new Container()
  private readonly rivalCard = new Graphics()
  private readonly rivalMark = new Graphics()
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
  private readonly waiters: DeltaWaiter[] = []
  private geometry: SparkBoardGeometry = { left: 0, top: 0, cellSize: 1 }
  private state: SparkRivalState = createSparkRivalState(this.encounter, 'spark-rival-touch-proof-v1')
  private previewBoard: readonly SparkOrb[] = this.state.board
  private actionCount = 0
  private inputLocked = false
  private destroyed = false
  private mounted = false
  private reducedMotion = false
  private status = 'Drag an orb through several cells. The clock starts when it moves.'
  private pointerX = 0
  private pointerY = 0
  private heldIndex: number | null = null
  private ignoredPointers = 0
  private hudElapsed = 0
  private lastWidth = 0
  private lastHeight = 0
  private rivalPulse = 0

  constructor(private readonly onHud: (hud: SparkRivalProofHud) => void) {
    this.rivalGlyph.anchor.set(0.5)
    this.rivalLayer.addChild(this.rivalCard, this.rivalMark, this.rivalGlyph)
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
    this.app.canvas.setAttribute('aria-label', 'Spark Rival six by five orb board')
    this.app.stage.sortableChildren = true
    this.app.stage.addChild(this.background, this.rivalLayer, this.boardPlate, this.boardLayer, this.effectLayer)
    this.buildPool()
    this.layout(true)
    this.renderBoard(this.state.board)
    this.bindPointerEvents()
    this.app.ticker.add(this.update)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.emitHud()
  }

  destroy(): void {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.mounted) this.unbindPointerEvents()
    for (const waiter of this.waiters.splice(0)) waiter.resolve()
    if (this.mounted) this.app.destroy({ removeView: true }, { children: true })
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value
  }

  reset(): void {
    if (this.inputLocked) return
    this.controller.cancel()
    this.state = createSparkRivalState(this.encounter, 'spark-rival-touch-proof-v1')
    this.previewBoard = this.state.board
    this.actionCount = 0
    this.status = 'Proof reset to the same seed and board.'
    this.renderBoard(this.state.board)
    this.emitHud()
  }

  triggerShift(): void {
    if (this.inputLocked || this.controller.snapshot) return
    void this.resolveAction({ type: 'spark-shift' })
  }

  playBestAdjacentDemo(): void {
    if (this.inputLocked || this.controller.snapshot || this.state.outcome) return
    const best = this.bestAdjacentAction()
    if (best) void this.resolveAction(best.action)
  }

  toggleHeldDemo(): void {
    if (this.inputLocked || this.state.outcome) return
    if (this.controller.snapshot) {
      this.controller.cancel()
      this.previewBoard = this.state.board
      this.status = 'Held proof cancelled; no action reached the engine.'
      this.renderBoard(this.state.board)
      this.emitHud()
      return
    }
    const best = this.bestAdjacentAction()
    if (!best || best.action.type !== 'drag') return
    const [from, to] = best.action.path
    if (!from || !to) return
    this.controller.begin(-1, from)
    this.controller.move(-1, to, performance.now())
    this.pointerX = this.geometry.left + (to.column + 0.5) * this.geometry.cellSize
    this.pointerY = this.geometry.top + (to.row + 0.5) * this.geometry.cellSize
    this.previewBoard = applySparkPath(this.state.board, best.action.path)
    this.status = 'Held-orb proof · displaced cell visible · cancel or wait for timeout.'
    this.renderBoard(this.previewBoard, to.row * SPARK_RIVAL_BOARD_WIDTH + to.column)
    this.emitHud()
  }

  private bestAdjacentAction(): { action: SparkRivalAction; resolution: SparkRivalResolution } | null {
    let best: { action: SparkRivalAction; resolution: SparkRivalResolution } | null = null
    for (let from = 0; from < 30; from += 1) for (let to = 0; to < 30; to += 1) {
      const left = sparkIndexCell(from)
      const right = sparkIndexCell(to)
      if (Math.max(Math.abs(left.row - right.row), Math.abs(left.column - right.column)) !== 1) continue
      const action = { type: 'drag' as const, path: [left, right], movementMs: 320 }
      const candidate = reduceSparkRival(this.encounter, this.state, action, this.actionCount)
      if (!best || candidate.resolution.combos > best.resolution.combos) best = { action, resolution: candidate.resolution }
    }
    return best
  }

  private buildPool(): void {
    for (let index = 0; index < 30; index += 1) {
      const root = new Container()
      const body = new Graphics()
      const shine = new Sprite(Texture.WHITE)
      shine.anchor.set(0.5)
      shine.rotation = Math.PI / 4
      shine.alpha = 0.22
      const glyph = new Text({
        text: '',
        style: { fontFamily: 'Outfit, system-ui, sans-serif', fontSize: 24, fontWeight: '800', fill: 0xffffff, stroke: { color: INK, width: 3 } },
      })
      glyph.anchor.set(0.5)
      root.addChild(body, shine, glyph)
      this.boardLayer.addChild(root)
      this.tokens.push({ root, body, shine, glyph })
      this.tokenTargets.push({ x: 0, y: 0 })
    }
    for (let index = 0; index < EFFECT_POOL_SIZE; index += 1) {
      const graphic = new Graphics().circle(0, 0, 4).fill({ color: 0xffffff })
      graphic.visible = false
      this.effectLayer.addChild(graphic)
      this.effects.push({ graphic, active: false, vx: 0, vy: 0, life: 0 })
    }
  }

  private layout(force = false): void {
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (!force && width === this.lastWidth && height === this.lastHeight) return
    this.lastWidth = width
    this.lastHeight = height
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
    this.rivalCard.clear().roundRect(-76, -29, 152, 58, 18)
      .fill({ color: 0x172838, alpha: 0.98 }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.14 })
    this.rivalMark.clear()
      .poly([-36, 17, -52, -6, -38, -23, -20, -9]).fill({ color: 0xe05d58, alpha: 0.8 })
      .poly([36, 17, 52, -6, 38, -23, 20, -9]).fill({ color: 0xe05d58, alpha: 0.8 })
      .circle(0, 0, 24).fill({ color: 0xe05d58 }).stroke({ width: 3, color: 0xffffff, alpha: 0.8 })
    this.rivalGlyph.position.set(0, 1)

    for (let index = 0; index < this.tokens.length; index += 1) {
      const token = this.tokens[index]!
      const radius = cellSize * 0.4
      token.body.clear().circle(0, 0, radius)
        .fill({ color: 0xffffff }).stroke({ width: Math.max(2, cellSize * 0.045), color: 0xffffff, alpha: 0.78 })
      token.shine.width = radius * 0.82
      token.shine.height = radius * 0.82
      token.glyph.style.fontSize = Math.max(18, Math.round(cellSize * 0.42))
      this.placeToken(index, true)
    }
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

  private renderBoard(
    board: readonly SparkOrb[],
    heldIndex: number | null = null,
    displaced?: { tokenIndex: number; fromIndex: number },
  ): void {
    this.heldIndex = heldIndex
    for (let index = 0; index < this.tokens.length; index += 1) {
      const orb = board[index]!
      const token = this.tokens[index]!
      token.body.tint = ORB_COLORS[orb]
      token.shine.tint = 0xffffff
      token.shine.alpha = orb === 'spark' ? 0.9 : 0.22
      token.glyph.text = ORB_GLYPHS[orb]
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

  private async resolveAction(action: SparkRivalAction): Promise<void> {
    if (this.inputLocked || this.state.outcome) return
    this.inputLocked = true
    const before = this.state
    const reduced = reduceSparkRival(this.encounter, before, action, this.actionCount)
    this.actionCount += 1
    this.status = reduced.resolution.combos === 0 ? 'No match — the rival still advances.' : `${reduced.resolution.combos} combo${reduced.resolution.combos === 1 ? '' : 's'}!`
    this.emitHud()
    await this.animateResolution(reduced.resolution, reduced.state)
    if (this.destroyed) return
    this.state = reduced.state
    this.previewBoard = this.state.board
    this.inputLocked = false
    this.renderBoard(this.state.board)
    this.status = this.state.outcome
      ? this.state.outcome.kind === 'clear' ? `Circuit cleared · ${this.state.outcome.trainingExp} EXP` : `Run lost · ${this.state.outcome.trainingExp} EXP banked`
      : 'Your move. The board and gauges are ready.'
    this.emitHud()
  }

  private async animateResolution(resolution: SparkRivalResolution, finalState: SparkRivalState): Promise<void> {
    if (resolution.action.type === 'spark-shift') {
      this.renderBoard(finalState.board)
      await this.wait(this.reducedMotion ? 70 : 360)
      return
    }
    if (resolution.cascades.length === 0) {
      this.renderBoard(finalState.board)
      await this.wait(this.reducedMotion ? 50 : 220)
    }
    for (const cascade of resolution.cascades) {
      this.renderBoard(cascade.before)
      for (const group of cascade.groups) for (const index of group.indices) {
        this.tokens[index]!.root.alpha = 0.28
        this.burst(index, ORB_COLORS[group.orb])
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
      this.status = `${step.attack.orb === 'spark' ? 'Spark' : step.attack.orb} hit · ${step.attack.appliedAmount} Resolve`
      this.emitHud()
      await this.wait(this.reducedMotion ? 45 : 150)
    } else if (step.type === 'rival-intent') {
      this.status = `Rival used ${step.intent.type.replace('-', ' ')}`
      this.emitHud()
      await this.wait(this.reducedMotion ? 45 : 240)
    } else if (step.type === 'wave-clear') {
      this.status = `Wave ${step.wave} cleared`
      this.emitHud()
      await this.wait(this.reducedMotion ? 80 : 420)
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
      this.inputLocked = true
      this.status = 'Time! Resolving the recorded path.'
      this.emitHud()
      this.inputLocked = false
      void this.resolveAction(timedOut)
    }
    this.hudElapsed += deltaMs
    if (this.hudElapsed >= 250) {
      this.hudElapsed = 0
      this.emitHud(Math.round(ticker.FPS))
    }
  }

  private emitHud(fps = Math.round(this.app.ticker.FPS || 0)): void {
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
      dragging: active !== null,
      movementRemainingMs: elapsed,
      inputLocked: this.inputLocked,
      outcome: this.state.outcome?.kind ?? null,
      status: this.status,
      debug: {
        boardSprites: `${this.tokens.length}/30`,
        activeEffects: this.effects.filter((effect) => effect.active).length,
        effectCapacity: this.effects.length,
        fps,
        pointerMoveReactUpdates: 0,
        ignoredPointers: this.ignoredPointers,
      },
    })
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.app.ticker.stop()
    else this.app.ticker.start()
  }
}
