// Pixi presentation only. Combat events are durable before playback (Uma Puzzles §5, implementation §5).
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { PUZZLE_BOARD_SIZE, PUZZLE_BOARD_WIDTH, PUZZLE_BOARD_HEIGHT, PUZZLE_MOVEMENT_MS, PUZZLE_MASS_MIN, puzzleCellIndex,
  puzzleFocus, type PuzzleBattleAction, type PuzzleBattleStateV1, type PuzzleBattleTransition, type PuzzleOrb } from '@racer/domain'
import type { ContentAsset } from '../../content/runtime'
import { PuzzlePointerController, puzzleCellAtPoint } from './pointer'
export interface PuzzleSceneHud { remaining: number; dragging: boolean; foeHeight: number; feedback: string }
export type PuzzleSceneImage = { url: string; frame: { x: number; y: number; width: number; height: number } }
export interface PuzzleSceneArt { board: Partial<Record<PuzzleOrb, string | ContentAsset>>; enemies: (PuzzleSceneImage | null)[]; isolated: boolean }
interface Token { root: Container; body: Graphics; art: Sprite; mask: Graphics; glyph: Graphics; x: number; y: number }
interface Effect { root: Graphics; life: number; dx: number; dy: number }
export interface PuzzleSceneOptions {
  host: HTMLElement; state: PuzzleBattleStateV1; art: PuzzleSceneArt; reducedMotion: boolean; plain: boolean
  canInput(): boolean; focus(): string | null
  act(action: PuzzleBattleAction, animate: (step: PuzzleBattleTransition) => Promise<void>): Promise<unknown>
  hud(value: PuzzleSceneHud): void
}
/** Owns decoded textures, never the content library's held URLs. No engine RNG is read here. */
export class PuzzleBattleScene {
  readonly pointer = new PuzzlePointerController()
  private app = new Application()
  private tokens: Token[] = []
  private foes: (Sprite | Graphics)[] = []
  private foeScales: number[] = []
  private textures = new Map<PuzzleOrb, Texture>()
  private owned: Texture[] = []
  private effects: Effect[] = []
  private labels: { text: Text; life: number }[] = []
  private waits: { ms: number; resolve(): void }[] = []
  private geometry = { left: 0, top: 0, cellSize: 1 }
  private state: PuzzleBattleStateV1
  private board: PuzzleOrb[]
  private destroyed = false
  private paused = false
  private playing = false
  private previousSize = ''
  private hudTime = 0
  private held: { x: number; y: number } | null = null
  private feedback = 'Drag an orb through its neighbours.'
  private colours: Record<PuzzleOrb, number>
  private resize: ResizeObserver | null = null
  private animation = 0
  private frameSamples: number[] = []
  private sampleCount = 0
  private maxPointerMs = 0
  private constructor(private options: PuzzleSceneOptions) {
    this.state = options.state; this.board = [...options.state.board]
    const css = getComputedStyle(document.documentElement)
    const colour = (key: string) => Number.parseInt(css.getPropertyValue(key).trim().replace('#', ''), 16)
    this.colours = { fire: colour('--color-puzzle-fire'), water: colour('--color-puzzle-water'), wood: colour('--color-puzzle-wood'),
      light: colour('--color-puzzle-light'), dark: colour('--color-puzzle-dark'), heart: colour('--color-puzzle-heart') }
  }
  static async create(options: PuzzleSceneOptions) {
    const scene = new PuzzleBattleScene(options)
    try { await scene.init(); return scene } catch (e) { scene.destroy(); throw e }
  }
  private async texture(source: string | PuzzleSceneImage) {
    const image = new Image(); image.src = typeof source === 'string' ? source : source.url; await image.decode()
    if (this.destroyed) throw new Error('Renderer disposed')
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256
    const context = canvas.getContext('2d')!
    if (typeof source === 'string') context.drawImage(image, 0, 0, 256, 256)
    else context.drawImage(image, source.frame.x, source.frame.y, source.frame.width, source.frame.height, 0, 0, 256, 256)
    const texture = Texture.from(canvas); this.owned.push(texture); return texture
  }
  private async init() {
    await this.app.init({ resizeTo: this.options.host, backgroundAlpha: 0, antialias: true, autoDensity: true,
      resolution: Math.min(devicePixelRatio || 1, 3), preference: 'webgl' })
    this.app.stop()
    await Promise.all(Object.entries(this.options.art.board).map(async ([orb, source]) => {
      try { if (source) this.textures.set(orb as PuzzleOrb, await this.texture(source)) } catch { /* Plain glyph stays readable; art cannot change rules. */ }
    }))
    for (const [i, enemy] of this.state.input.enemies.entries()) {
      const asset = this.options.art.enemies[i]
      let foe: Sprite | Graphics
      if (asset) { foe = new Sprite(await this.texture(asset)); foe.anchor.set(0.5) }
      else {
        if (!this.options.art.isolated) throw new Error('Verified enemy art unavailable. The frozen fight is retained.')
        foe = new Graphics().roundRect(-25, -25, 50, 45, 15).fill(this.colours[enemy.element])
          .circle(-9, -7, 4).circle(9, -7, 4).fill(0x101a24)
          .moveTo(-14, -24).lineTo(-23, -38).lineTo(-2, -24).fill(this.colours[enemy.element])
      }
      this.foes.push(foe); this.app.stage.addChild(foe)
    }
    for (let i = 0; i < PUZZLE_BOARD_SIZE; i++) {
      const root = new Container(), body = new Graphics(), art = new Sprite(Texture.EMPTY), mask = new Graphics(), glyph = new Graphics()
      art.anchor.set(0.5); art.mask = mask; root.addChild(body, art, mask, glyph); this.app.stage.addChild(root)
      this.tokens.push({ root, body, art, mask, glyph, x: 0, y: 0 })
    }
    for (let i = 0; i < 36; i++) {
      const root = new Graphics().circle(0, 0, 3).fill(0xffffff); root.visible = false; this.app.stage.addChild(root)
      this.effects.push({ root, life: 0, dx: 0, dy: 0 })
    }
    for (let i = 0; i < 8; i++) {
      const text = new Text({ text: '', style: { fontFamily: 'Outfit, sans-serif', fontWeight: '700', fontSize: 19, fill: 0xf2f6fa,
        stroke: { color: 0x101a24, width: 4 } } }); text.anchor.set(0.5); text.visible = false; this.app.stage.addChild(text)
      this.labels.push({ text, life: 0 })
    }
    const canvas = this.app.canvas
    canvas.style.touchAction = 'none'; canvas.style.display = 'block'; canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Six by five elemental board. Drag with one pointer; keyboard dragging is not supported. Practice is available from the guide.')
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.cancelEvent)
    canvas.addEventListener('lostpointercapture', this.cancelEvent)
    this.options.host.append(canvas); this.layout(true)
    this.resize = new ResizeObserver(() => { this.cancel(); this.layout(true) }); this.resize.observe(this.options.host)
    this.app.ticker.add(this.tick); if (!document.hidden) this.app.start()
  }
  private layout(force = false) {
    const w = this.options.host.clientWidth, h = this.options.host.clientHeight, size = `${w}:${h}`
    if (!force && size === this.previousSize) return
    this.previousSize = size; this.cancel()
    const cellSize = Math.max(1, Math.min((w - 12) / PUZZLE_BOARD_WIDTH, (h - 78) / PUZZLE_BOARD_HEIGHT))
    this.geometry = { left: (w - cellSize * PUZZLE_BOARD_WIDTH) / 2, top: h - cellSize * PUZZLE_BOARD_HEIGHT - 2, cellSize }
    this.foes.forEach((foe, i) => { foe.position.set(w * (i + 0.5) / this.foes.length, Math.max(29, this.geometry.top * 0.48))
      if (foe instanceof Sprite) { foe.width = Math.min(90, this.geometry.top * 0.85); foe.height = foe.width }
      this.foeScales[i] = foe.scale.x })
    this.tokens.forEach((t, i) => { t.x = this.geometry.left + (i % PUZZLE_BOARD_WIDTH + 0.5) * cellSize
      t.y = this.geometry.top + (Math.floor(i / PUZZLE_BOARD_WIDTH) + 0.5) * cellSize; t.root.position.set(t.x, t.y) })
    this.draw(); this.emit()
  }
  private glyph(g: Graphics, orb: PuzzleOrb, colour: number) {
    g.clear()
    if (orb === 'heart') g.moveTo(0, 8).bezierCurveTo(-18, -3, -9, -15, 0, -7).bezierCurveTo(9, -15, 18, -3, 0, 8).fill(colour)
    else if (orb === 'fire') g.moveTo(0, -12).bezierCurveTo(1, -2, 12, -2, 8, 7).bezierCurveTo(0, 15, -14, 6, -7, -3)
      .lineTo(-2, 2).closePath().fill(colour)
    else if (orb === 'water') g.moveTo(0, -11).bezierCurveTo(-20, 8, -3, 16, 6, 8).bezierCurveTo(13, 0, 4, -5, 0, -11).fill(colour)
    else if (orb === 'wood') g.ellipse(0, 0, 8, 12).fill(colour).moveTo(-4, 7).lineTo(4, -7).stroke({ width: 2, color: 0x101a24 })
    else if (orb === 'light') g.moveTo(0, -12).lineTo(4, -4).lineTo(12, 0).lineTo(4, 4).lineTo(0, 12)
      .lineTo(-4, 4).lineTo(-12, 0).lineTo(-4, -4).closePath().fill(colour)
    else g.circle(0, 0, 11).fill(colour).circle(5, -4, 9).fill(0x101a24)
  }
  private draw() {
    const radius = this.geometry.cellSize * 0.42, current = this.pointer.current, held = current ? puzzleCellIndex(current.path.at(-1)!) : -1
    this.tokens.forEach((t, i) => {
      const orb = this.board[i]!, colour = this.colours[orb], texture = this.options.plain ? undefined : this.textures.get(orb)
      t.body.clear().circle(0, 0, radius).fill({ color: 0x101a24, alpha: 0.98 })
        .circle(0, 0, radius - 2).fill({ color: colour, alpha: texture ? 0.25 : 0.18 })
        .stroke({ color: i === held ? 0xffffff : colour, width: i === held ? 4 : 2.5 })
      t.art.visible = !!texture; if (texture) t.art.texture = texture
      t.art.width = radius * 1.65; t.art.height = radius * 1.65
      t.mask.clear().circle(0, 0, radius * 0.83).fill(0xffffff)
      this.glyph(t.glyph, orb, colour)
      t.glyph.scale.set(texture ? radius / 38 : radius / 20)
      t.glyph.position.set(texture ? radius * 0.62 : 0, texture ? radius * 0.55 : 0)
      t.root.zIndex = i === held ? 2 : 0
    })
    this.app.stage.sortableChildren = true
    this.foes.forEach((f, i) => { f.alpha = this.state.enemies[i]!.hp ? 1 : 0.18 })
  }
  private point(e: PointerEvent) {
    const r = this.app.canvas.getBoundingClientRect()
    return { x: (e.clientX - r.left) * this.options.host.clientWidth / r.width, y: (e.clientY - r.top) * this.options.host.clientHeight / r.height }
  }
  private down = (e: PointerEvent) => {
    if (this.paused || this.playing || !this.options.canInput() || e.button !== 0) return
    const point = this.point(e), cell = puzzleCellAtPoint(point.x, point.y, this.geometry)
    if (!cell || !this.pointer.begin(e.pointerId, cell, puzzleFocus(this.state, this.options.focus()))) return
    try { this.app.canvas.setPointerCapture(e.pointerId) } catch { this.pointer.cancel(); return }
    e.preventDefault(); this.held = point; this.draw(); this.emit()
  }
  private move = (e: PointerEvent) => {
    const measuredAt = performance.now()
    const c = this.pointer.current
    if (!c || c.pointerId !== e.pointerId) return
    const expired = this.pointer.timeout(performance.now())
    if (expired) { this.release(e.pointerId); this.submit(expired); return }
    e.preventDefault(); const point = this.point(e), cell = puzzleCellAtPoint(point.x, point.y, this.geometry), before = c.path.length
    if (cell && this.pointer.move(e.pointerId, cell, performance.now())) {
      for (let i = before; i < c.path.length; i++) {
        const a = puzzleCellIndex(c.path[i - 1]!), b = puzzleCellIndex(c.path[i]!), orb = this.board[a]!
        this.board[a] = this.board[b]!; this.board[b] = orb
        // The displaced neighbour slides from the cell the held orb just occupied.
        const token = this.tokens[a]!, from = this.tokens[b]!; token.root.position.set(from.x, from.y)
      }
      this.draw()
    }
    this.held = { x: Math.max(this.geometry.left, Math.min(point.x, this.geometry.left + this.geometry.cellSize * PUZZLE_BOARD_WIDTH)),
      y: Math.max(this.geometry.top, Math.min(point.y, this.geometry.top + this.geometry.cellSize * PUZZLE_BOARD_HEIGHT)) }
    const timed = this.pointer.timeout(performance.now()); if (timed) { this.release(e.pointerId); this.submit(timed) }
    if (import.meta.env.DEV) { this.sampleCount++; this.maxPointerMs = Math.max(this.maxPointerMs, performance.now() - measuredAt) }
  }
  private up = (e: PointerEvent) => {
    if (this.pointer.current?.pointerId !== e.pointerId) return
    const action = this.pointer.release(e.pointerId, performance.now()); this.release(e.pointerId)
    if (action) this.submit(action); else { this.board = [...this.state.board]; this.draw(); this.emit() }
  }
  private release(id: number) {
    this.held = null
    if (this.app.canvas.hasPointerCapture(id)) this.app.canvas.releasePointerCapture(id)
  }
  private cancelEvent = (e: PointerEvent) => { if (this.pointer.current?.pointerId === e.pointerId) this.cancel() }
  cancel() {
    const id = this.pointer.current?.pointerId; this.pointer.cancel()
    if (id !== undefined && this.app.canvas) this.release(id)
    this.board = [...this.state.board]; if (this.tokens.length) { this.draw(); this.emit() }
  }
  pause(value: boolean) {
    this.paused = value; this.cancel()
    if (value) { this.animation++; this.flushWaits(); this.app.stop() }
    else if (!document.hidden) this.app.start()
  }
  setState(state: PuzzleBattleStateV1) {
    this.state = state
    if (!this.playing) { this.cancel(); this.board = [...state.board]; this.draw() }
  }
  setVisuals(plain: boolean, reducedMotion: boolean) { this.options.plain = plain; this.options.reducedMotion = reducedMotion; this.draw() }
  async setBoardArt(sources: Partial<Record<PuzzleOrb, string>>) {
    await Promise.all(Object.entries(sources).map(async ([orb, url]) => {
      try { if (url) { const t = await this.texture(url); if (!this.destroyed) this.textures.set(orb as PuzzleOrb, t) } } catch { /* Keep the held atlas fallback. */ }
    }))
    if (!this.destroyed) this.draw()
  }
  private submit(action: PuzzleBattleAction) {
    if (this.playing) return
    this.playing = true; this.emit()
    void this.options.act(action, s => this.animate(s)).finally(() => {
      this.playing = false; if (!this.destroyed) { this.cancel(); this.draw(); this.emit() }
    })
  }
  async active(action: PuzzleBattleAction) { this.cancel(); this.submit(action) }
  private emit() {
    if (import.meta.env.DEV) {
      const sorted = [...this.frameSamples].sort((a, b) => a - b)
      this.options.host.dataset.puzzleProfile = JSON.stringify({ frames: sorted.length, frameP95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        pointerSamples: this.sampleCount, maxPointerMs: this.maxPointerMs, tokens: this.tokens.length, particles: this.effects.length, labels: this.labels.length })
    }
    if (!this.destroyed) this.options.hud({ remaining: this.pointer.current?.startedAt === null || !this.pointer.current ? PUZZLE_MOVEMENT_MS :
    Math.max(0, PUZZLE_MOVEMENT_MS - (performance.now() - this.pointer.current.startedAt)), dragging: !!this.pointer.current,
    foeHeight: this.geometry.top, feedback: this.feedback }) }
  private label(text: string, x: number, y: number, colour = 0xf2f6fa) {
    const l = this.labels.find(l => l.life <= 0) ?? this.labels[0]!
    l.life = 760; l.text.text = text; l.text.style.fill = colour; l.text.position.set(x, y); l.text.alpha = 1; l.text.visible = true
  }
  private burst(index: number, colour: number) {
    const token = this.tokens[index]!
    for (let n = 0; n < 4; n++) {
      const e = this.effects.find(e => e.life <= 0); if (!e) break
      e.life = 300; e.root.position.set(token.x, token.y); e.root.tint = colour; e.root.visible = true
      e.dx = [-0.06, 0.06, -0.035, 0.035][n]!; e.dy = [-0.06, -0.06, 0.04, 0.04][n]!
    }
  }
  private wait(ms: number) { return this.options.reducedMotion || this.paused || this.destroyed ? Promise.resolve() :
    new Promise<void>(resolve => this.waits.push({ ms, resolve })) }
  private flushWaits() { this.waits.splice(0).forEach(w => w.resolve()) }
  async animate(step: PuzzleBattleTransition) {
    const animation = ++this.animation; let combos = 0
    for (const e of step.events) {
      if (this.destroyed || animation !== this.animation || this.paused) break
      if (e.type === 'cascade') {
        combos += e.cascade.groups.length; this.feedback = `${combos} combos${e.cascade.groups.some(g => g.indices.length >= PUZZLE_MASS_MIN && g.orb !== 'heart') ? ' · Mass attack' : ''}`
        this.board = [...e.cascade.before]; this.draw()
        e.cascade.cleared.forEach(i => { this.tokens[i]!.root.alpha = 0.25; if (!this.options.reducedMotion) this.burst(i, this.colours[this.board[i]!]) })
        this.label(`${combos} COMBOS`, this.options.host.clientWidth / 2, this.geometry.top + 20); this.emit(); await this.wait(180)
        this.board = [...e.cascade.after]; this.draw()
        this.tokens.forEach(t => { t.root.alpha = 1 })
        if (!this.options.reducedMotion) {
          e.cascade.falls.forEach(f => { const t = this.tokens[f.to]!, from = this.tokens[f.from]!; t.root.position.set(from.x, from.y) })
          e.cascade.refills.forEach(f => { const t = this.tokens[f.index]!; t.root.y = this.geometry.top - this.geometry.cellSize })
        }
        await this.wait(180)
      } else if (e.type === 'conversion') { this.board = [...e.after]; this.draw(); await this.wait(140) }
      else if (e.type === 'hit') {
        const i = step.state.enemies.findIndex(f => f.id === e.enemyId), foe = this.foes[i]
        if (foe) { this.label(`−${e.amount}`, foe.x, foe.y, this.colours[e.element]); foe.alpha = 0.45; if (!this.options.reducedMotion) foe.scale.set(this.foeScales[i]! * 1.06) }
      } else if (e.type === 'heal') { this.feedback = `Heart +${e.amount} HP`; this.label(`+${e.amount} HP`, this.options.host.clientWidth / 2, this.geometry.top - 10, this.colours.heart) }
      else if (e.type === 'phase') this.feedback = `Phase change · ${e.countdown} drags warning`
      else if (e.type === 'shield') this.feedback = e.consumed ? 'Shield absorbed the damaging phase' : `Shield ${Math.round(e.reduction * 100)}% ready`
      else if (e.type === 'delay') this.feedback = `Intent delayed · ${e.countdown} drags`
      else if (e.type === 'retarget') this.feedback = 'Target defeated · retargeting'
      else if (e.type === 'enemy-intent' && e.intent.type === 'attack') { this.feedback = `Incoming hit −${e.amount} HP`; this.label(this.feedback, this.options.host.clientWidth / 2, this.geometry.top - 5) }
      this.emit()
    }
    await this.wait(260)
    if (this.destroyed) return
    this.state = step.state; this.board = [...step.state.board]
    this.tokens.forEach(t => { t.root.alpha = 1 }); this.foes.forEach((f, i) => f.scale.set(this.foeScales[i]!)); this.draw()
    this.feedback = step.state.outcome === 'active' ? `${combos} combos · choose your next move` : 'Saving the result receipt…'; this.emit()
  }
  private tick = (ticker: { deltaMS: number }) => {
    if (this.destroyed || this.paused) return
    this.layout(); const dt = Math.min(50, ticker.deltaMS)
    if (import.meta.env.DEV) { this.frameSamples.push(ticker.deltaMS); if (this.frameSamples.length > 180) this.frameSamples.shift() }
    for (let i = this.waits.length - 1; i >= 0; i--) { const w = this.waits[i]!; w.ms -= dt; if (w.ms <= 0) { this.waits.splice(i, 1); w.resolve() } }
    for (const e of this.effects) if (e.life > 0) { e.life -= dt; e.root.x += dt * e.dx; e.root.y += dt * e.dy; e.root.alpha = Math.max(0, e.life / 300); e.root.visible = e.life > 0 }
    for (const l of this.labels) if (l.life > 0) { l.life -= dt; l.text.y -= dt * 0.018; l.text.alpha = Math.max(0, l.life / 760); l.text.visible = l.life > 0 }
    const heldIndex = this.pointer.current ? puzzleCellIndex(this.pointer.current.path.at(-1)!) : -1
    this.tokens.forEach((t, i) => { const target = i === heldIndex && this.held ? { x: this.held.x, y: this.held.y - 16 } : t
      const factor = this.options.reducedMotion || i === heldIndex ? 1 : 1 - Math.exp(-dt / 45)
      t.root.x += (target.x - t.root.x) * factor; t.root.y += (target.y - t.root.y) * factor })
    const id = this.pointer.current?.pointerId, action = this.pointer.timeout(performance.now())
    if (action && id !== undefined) { this.release(id); this.submit(action) }
    this.hudTime += dt; if (this.hudTime >= 200) { this.hudTime = 0; this.emit() }
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true; this.animation++; this.pointer.cancel(); this.flushWaits(); this.resize?.disconnect()
    if (this.app.canvas) { const c = this.app.canvas
      c.removeEventListener('pointerdown', this.down); c.removeEventListener('pointermove', this.move); c.removeEventListener('pointerup', this.up)
      c.removeEventListener('pointercancel', this.cancelEvent); c.removeEventListener('lostpointercapture', this.cancelEvent) }
    if (this.app.renderer) this.app.destroy(true, { children: true, texture: false })
    this.owned.forEach(t => t.destroy(true))
  }
}
