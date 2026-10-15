import type { RaceCourseLayout } from '@racer/domain'
import { COURSE_WIDTH, phaseAt, raceTurns, sampleTimeline, timelineDuration, turnPhase, type RaceTimeline, type RunnerFrame } from '@racer/race'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { buildCoursePath, courseBounds, sampleCourse, type CoursePath } from './course-path'
import {
  RacePlaybackClock,
  buildRaceCues,
  coursePositionLabel,
  isPhotoFinish,
  liveRaceCues,
  type RaceCue,
  type RacePresentationStage,
} from './presentation'

// Plays a pre-simulated race timeline back at the display's refresh rate (docs/game/architecture.md#the-race).
// The race runs on its own course (M018 part D): the snapshotted corners and straights laid out as a path, a follow
// camera that turns with the pack so runners always travel left to right, and a minimap of the whole course.

export interface SceneRunner {
  label: string
  color: number
  isPlayer: boolean
  lane: number
}

export interface RaceHudState {
  seconds: number
  duration: number
  phase: number
  /** Engine v6 races: the turn being run (1-based) and the course's turn count; null on older, time-based replays. */
  turn: number | null
  turns: number | null
  playerDistance: number
  playerHp: number
  playerPosition: number
  /** Per runner, distance share 0–1, for the progress rail. */
  shares: number[]
  finished: boolean
  stage: RacePresentationStage
  courseLabel: string | null
  /** The race feed's toasts at this moment, newest first (D178). */
  cues: RaceCue[]
}

interface Token {
  root: Container
  body: Graphics
  label: Text
  /** The runner's face once it has loaded (T059); until then, or without one, the numbered dot. */
  face: Sprite | null
}

const TURF_A = 0x4cb85a
const TURF_B = 0x45ab52
const OUTFIELD = 0x3c9a4c
const RAIL = 0xffffff
const INK = 0x23324a
const PLAYER = 0xffc42e
/** Lanes are drawn this many times their true width, so a pack stays readable on a phone. */
const LANE_SCALE = 3.5
const BAND = COURSE_WIDTH * LANE_SCALE
/** Grass between each rail and the running lanes, in drawn meters. */
const VERGE = 2
const STRIPE_METERS = 10
const SAMPLE_METERS = 4
const TOKEN_RADIUS = 9
/** A face token: the face, her colour ring round it, and her gate number on a badge at her shoulder. */
const FACE_RADIUS = 12
const BADGE_RADIUS = 6.5
const BADGE_OFFSET = FACE_RADIUS * 0.78
/** Faces are drawn into a circle once, at this size, so the ticker never masks a sprite. */
const FACE_TEXTURE = 96
const HUD_INTERVAL_MS = 100
const MINIMAP = { width: 104, height: 70, margin: 10, padding: 8 }
const visualUnit = (value: number) => (Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0) / 4294967296

export class RaceScene {
  private readonly app = new Application()
  private destroyed = false
  private mounted = false
  private elapsed = 0
  private speed = 1
  private finishedNotified = false
  private hudTimer = 0
  private readonly duration: number
  private readonly clock: RacePlaybackClock
  private readonly cues: RaceCue[]
  private readonly frames: RunnerFrame[] = []
  private readonly path: CoursePath
  private readonly camera = { center: 0, span: 70, angle: 0 }

  private readonly background = new Graphics()
  private readonly world = new Container()
  private readonly track = new Graphics()
  private readonly runnerLayer = new Container()
  private readonly markerLayer = new Container()
  private readonly effects = new Graphics()
  private readonly minimap = new Graphics()
  private readonly markerLabels: Text[] = []
  private readonly tokens: Token[] = []
  private readonly faceTextures: Texture[] = []
  private pendingFaces: readonly (Texture | null)[] | null = null
  private readonly streaks = Array.from({ length: 10 }, (_, index) => ({
    x: visualUnit(index + 1),
    y: (index + 0.5) / 10,
    len: 0.15 + visualUnit(index + 101) * 0.2,
    cycle: 0,
  }))

  constructor(
    private readonly timeline: RaceTimeline,
    private readonly runners: SceneRunner[],
    private readonly playerIndex: number,
    private readonly onHud: (state: RaceHudState) => void,
    private readonly onFinish: () => void,
    private readonly reducedMotion = false,
    private readonly layout?: RaceCourseLayout,
    rotation?: number,
  ) {
    this.duration = timelineDuration(timeline)
    this.clock = new RacePlaybackClock(this.duration, isPhotoFinish(timeline), reducedMotion)
    this.cues = buildRaceCues(timeline, playerIndex)
    this.path = buildCoursePath(timeline.courseDistance, layout, rotation)
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
    this.world.addChild(this.track, this.markerLayer, this.runnerLayer)
    // Runners nearer the inner rail, the near side of the view, are drawn in front of those further out.
    this.runnerLayer.sortableChildren = true
    this.app.stage.addChild(this.background, this.world, this.effects, this.minimap)
    this.buildTokens()
    sampleTimeline(this.timeline, 0, this.frames)
    this.camera.center = this.frames[this.playerIndex]?.distance ?? 0
    this.camera.angle = sampleCourse(this.path, this.camera.center).heading
    if (this.reducedMotion) this.camera.span = 45
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS))
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  setSpeed(multiplier: number) {
    this.speed = multiplier
  }

  /** Engine v6 timelines record one frame per one-second turn. */
  get turnRace(): boolean {
    return this.timeline.tickRate === 1
  }

  /** Sim seconds played so far: the current turn's position for step controls. */
  get position(): number {
    return this.elapsed
  }

  skipToEnd() {
    this.elapsed = this.clock.skip().simSeconds
  }

  /** Jumps playback to `seconds` (replays, scrubbing, and dev tooling). */
  seek(seconds: number) {
    this.elapsed = this.clock.seek(seconds).simSeconds
  }

  destroy() {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.mounted) this.app.destroy({ removeView: true }, { children: true })
    for (const texture of this.faceTextures) texture.destroy(true)
    this.faceTextures.length = 0
  }

  /**
   * Puts each runner's face on her token (T059), by runner index; a null keeps her numbered dot. The images are the
   * art loader's verified object URLs. Safe to call before the scene has mounted or after it is gone.
   */
  async setFaces(urls: readonly (string | null)[]): Promise<void> {
    const textures = await Promise.all(urls.map(async (url) => {
      if (!url) return null
      try {
        const image = new Image()
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = FACE_TEXTURE
        canvas.height = FACE_TEXTURE
        const context = canvas.getContext('2d')
        if (!context) return null
        context.beginPath()
        context.arc(FACE_TEXTURE / 2, FACE_TEXTURE / 2, FACE_TEXTURE / 2, 0, Math.PI * 2)
        context.clip()
        context.drawImage(image, 0, 0, FACE_TEXTURE, FACE_TEXTURE)
        return Texture.from(canvas)
      } catch {
        // A face that will not decode just leaves her number.
        return null
      }
    }))
    if (this.destroyed) {
      for (const texture of textures) texture?.destroy(true)
      return
    }
    this.faceTextures.push(...textures.filter((texture): texture is Texture => texture !== null))
    if (this.tokens.length > 0) this.applyFaces(textures)
    else this.pendingFaces = textures
  }

  private applyFaces(textures: readonly (Texture | null)[]) {
    textures.forEach((texture, index) => {
      const token = this.tokens[index]
      const runner = this.runners[index]
      if (!texture || !token || !runner || token.face) return
      token.body.clear()
      if (runner.isPlayer) token.body.circle(0, 0, FACE_RADIUS + 5).fill({ color: PLAYER })
      token.body.circle(0, 0, FACE_RADIUS + 2).fill({ color: runner.color }).stroke({ width: 2, color: 0xffffff })
      const face = new Sprite(texture)
      face.anchor.set(0.5)
      face.width = FACE_RADIUS * 2
      face.height = FACE_RADIUS * 2
      const badge = new Graphics()
        .circle(BADGE_OFFSET, BADGE_OFFSET, BADGE_RADIUS)
        .fill({ color: runner.isPlayer ? PLAYER : runner.color })
        .stroke({ width: 1.5, color: 0xffffff })
      // Ring, face, badge, then her number on the badge.
      token.root.addChildAt(face, 1)
      token.root.addChildAt(badge, 2)
      token.face = face
      token.label.style.fontSize = 8
      token.label.style.stroke = { color: INK, width: 2 }
      token.label.position.set(BADGE_OFFSET, BADGE_OFFSET)
    })
  }

  private readonly onVisibility = () => {
    if (document.hidden) this.app.ticker.stop()
    else this.app.ticker.start()
  }

  private buildTokens() {
    this.runners.forEach((runner) => {
      const root = new Container()
      const body = new Graphics()
      if (runner.isPlayer) body.circle(0, 0, TOKEN_RADIUS + 4).fill({ color: PLAYER })
      body.circle(0, 0, TOKEN_RADIUS).fill({ color: runner.color }).stroke({ width: 2.5, color: 0xffffff })
      const label = new Text({
        text: runner.isPlayer ? '★' : runner.label,
        style: {
          fontFamily: 'M PLUS Rounded 1c, system-ui, sans-serif',
          fontSize: Math.round(TOKEN_RADIUS * 0.95),
          fontWeight: '800',
          fill: 0xffffff,
          stroke: { color: INK, width: 3 },
        },
      })
      label.anchor.set(0.5)
      root.addChild(body, label)
      this.runnerLayer.addChild(root)
      this.tokens.push({ root, body, label, face: null })
    })
    // Player drawn last so it's never hidden behind rivals.
    const player = this.tokens[this.playerIndex]
    if (player) this.runnerLayer.addChild(player.root)
    if (this.pendingFaces) {
      this.applyFaces(this.pendingFaces)
      this.pendingFaces = null
    }
  }

  /** A point on the course in Pixi world coordinates (meters, y down), `offset` drawn meters out from the inner rail. */
  private point(distance: number, offset: number): [number, number] {
    const at = sampleCourse(this.path, distance)
    return [at.x + at.outX * offset, -(at.y + at.outY * offset)]
  }

  private update(deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000
    const playback = this.clock.advance(dt, this.speed)
    this.elapsed = playback.simSeconds
    sampleTimeline(this.timeline, this.elapsed, this.frames)

    const width = this.app.screen.width
    const height = this.app.screen.height
    const course = this.timeline.courseDistance
    const player = this.frames[this.playerIndex]!

    // Camera: frame the pack, but always keep the player in view; ease towards the target (frame-rate independent).
    let lead = 0
    let tail = Infinity
    for (const f of this.frames) {
      lead = Math.max(lead, f.distance)
      tail = Math.min(tail, f.distance)
    }
    const staged = playback.stage !== 'running' && playback.stage !== 'photo' && playback.stage !== 'finished'
    const targetSpan = staged
      ? this.reducedMotion ? 45 : playback.stage === 'field' ? 90 : playback.stage === 'staged' ? 62 : 45
      : Math.min(160, Math.max(45, lead - tail + 30))
    let targetCenter = staged ? 5 : (lead + tail) / 2
    const half = targetSpan / 2 - 6
    if (player.distance < targetCenter - half) targetCenter = player.distance + half
    if (player.distance > targetCenter + half) targetCenter = player.distance - half
    // Snap on big jumps (seek/skip) instead of panning across the whole course.
    const snap = Math.abs(targetCenter - this.camera.center) > this.camera.span * 2
    const ease = snap ? 1 : 1 - Math.exp(-dt * 4)
    this.camera.span += (targetSpan - this.camera.span) * ease
    this.camera.center += (targetCenter - this.camera.center) * ease
    // The view turns with the course a little behind the pack, so corners read as corners.
    const targetAngle = sampleCourse(this.path, this.camera.center).heading
    this.camera.angle += (targetAngle - this.camera.angle) * (snap ? 1 : 1 - Math.exp(-dt * 2.5))

    const pxPerMeter = width / this.camera.span
    const [centerX, centerY] = this.point(this.camera.center, BAND / 2)
    this.world.pivot.set(centerX, centerY)
    this.world.position.set(width / 2, height * 0.46)
    this.world.scale.set(pxPerMeter)
    this.world.rotation = this.camera.angle

    this.background.clear().rect(0, 0, width, height).fill({ color: OUTFIELD })
    this.drawTrack(course, pxPerMeter)

    // Runners
    const order = this.frames.map((f, i) => ({ d: f.distance, i })).sort((a, b) => b.d - a.d)
    const position = order.findIndex((o) => o.i === this.playerIndex) + 1
    this.runners.forEach((runner, i) => {
      const token = this.tokens[i]!
      const frame = this.frames[i]!
      const lane = this.timeline.lane ? frame.lane : runner.lane * (COURSE_WIDTH / 18)
      // A small stride bob while running gives the flat tokens some life.
      const running = playback.stage === 'running' && frame.speed > 0.5 && frame.distance < course
      const bob = running ? (Math.sin(this.elapsed * 14 + i) * 1.5) / pxPerMeter : 0
      const [x, y] = this.point(frame.distance, VERGE + lane * LANE_SCALE)
      token.root.position.set(x, y + bob)
      token.root.zIndex = runner.isPlayer ? Number.MAX_SAFE_INTEGER : -lane
      // Tokens keep their screen size and stay upright while the world scales and turns.
      token.root.scale.set(1 / pxPerMeter)
      token.root.rotation = -this.camera.angle
      token.root.alpha = frame.hp <= 0.001 && running ? 0.6 : 1
    })

    // Last-spurt speed streaks. A turn race's phase is the race's, from the turn (M021).
    const turn = this.turnRace ? Math.max(1, Math.ceil(this.elapsed)) : null
    const phase = turn !== null ? turnPhase(turn, raceTurns(course)) : phaseAt(lead, course)
    this.effects.clear()
    if (!this.reducedMotion && playback.stage === 'running' && phase >= 3 && this.elapsed < this.duration) {
      for (const [index, streak] of this.streaks.entries()) {
        streak.x -= dt * this.speed * 1.6
        if (streak.x + streak.len < 0) {
          streak.cycle += 1
          streak.x = 1 + visualUnit(index + streak.cycle * 31) * 0.3
          streak.y = visualUnit(index + streak.cycle * 67)
        }
        const y = height * (0.25 + streak.y * 0.45)
        this.effects
          .moveTo(streak.x * width, y)
          .lineTo((streak.x + streak.len) * width, y)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.35 })
      }
    }

    this.drawMinimap(width, height)

    // HUD at ~10 Hz — React only re-renders the overlay this often.
    this.hudTimer += deltaMs
    const finished = playback.done
    if (this.hudTimer >= HUD_INTERVAL_MS || finished) {
      this.hudTimer = 0
      const finalPlacement = this.timeline.results.find((result) => result.runner === this.playerIndex)?.placement
      this.onHud({
        seconds: this.elapsed,
        duration: this.duration,
        phase,
        turn,
        turns: this.turnRace ? raceTurns(course) : null,
        playerDistance: player.distance,
        playerHp: player.hp,
        playerPosition: this.elapsed >= this.duration ? finalPlacement ?? position : position,
        shares: this.frames.map((f) => f.distance / course),
        finished,
        stage: playback.stage,
        courseLabel: coursePositionLabel(this.layout, player.distance),
        cues: playback.stage === 'running' ? liveRaceCues(this.cues, this.elapsed) : [],
      })
    }
    if (finished && !this.finishedNotified) {
      this.finishedNotified = true
      this.onFinish()
    }
  }

  /** The visible stretch of course, in world meters: mowing stripes, hills, rails, gate, finish and distance boards. */
  private drawTrack(course: number, pxPerMeter: number) {
    const g = this.track
    g.clear()
    const reach = this.camera.span * 0.9
    const from = Math.max(-20, Math.floor((this.camera.center - reach) / SAMPLE_METERS) * SAMPLE_METERS)
    const to = Math.min(course + 40, this.camera.center + reach)
    const outer = BAND + VERGE * 2
    const quad = (start: number, end: number, low: number, high: number) => {
      const [ax, ay] = this.point(start, low)
      const [bx, by] = this.point(end, low)
      const [cx, cy] = this.point(end, high)
      const [dx, dy] = this.point(start, high)
      return [ax, ay, bx, by, cx, cy, dx, dy]
    }

    // Turf, striped across the course so movement reads even while the camera tracks the pack.
    for (let d = from; d < to; d += SAMPLE_METERS) {
      const stripe = Math.floor(d / STRIPE_METERS) % 2 === 0 ? TURF_A : TURF_B
      g.poly(quad(d, d + SAMPLE_METERS + 0.2, 0, outer)).fill({ color: stripe })
    }
    // Hills: a climb shades darker, a descent lighter (engine v5).
    for (const slope of this.layout?.slopes ?? []) {
      const start = Math.max(from, slope.start)
      const end = Math.min(to, slope.end)
      for (let d = start; d < end; d += SAMPLE_METERS) {
        g.poly(quad(d, Math.min(end, d + SAMPLE_METERS + 0.2), 0, outer))
          .fill({ color: slope.slope > 0 ? 0x1f5a2b : 0xffffff, alpha: slope.slope > 0 ? 0.22 : 0.14 })
      }
    }
    // Rails, with posts every 10 m.
    const rail = (offset: number) => {
      const [sx, sy] = this.point(from, offset)
      g.moveTo(sx, sy)
      for (let d = from + SAMPLE_METERS; d <= to; d += SAMPLE_METERS) g.lineTo(...this.point(d, offset))
      g.stroke({ width: 3 / pxPerMeter, color: RAIL })
    }
    rail(0)
    rail(outer)
    for (let d = Math.ceil(from / STRIPE_METERS) * STRIPE_METERS; d <= to; d += STRIPE_METERS) {
      g.moveTo(...this.point(d, 0)).lineTo(...this.point(d, -1.2)).stroke({ width: 2.5 / pxPerMeter, color: RAIL })
    }

    // Start gate and finish line.
    if (from <= 1) g.poly(quad(-1, 0, 0, outer)).fill({ color: 0x9aa7b8 })
    if (to >= course) {
      const square = 1.2
      for (let row = 0; row * square < outer; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          g.poly(quad(course - square + col * square, course + col * square, row * square, Math.min(outer, (row + 1) * square)))
            .fill({ color: (row + col) % 2 === 0 ? 0xffffff : INK })
        }
      }
    }

    // Remaining-distance boards every 100 m, outside the inner rail (pooled labels).
    let used = 0
    for (let m = Math.max(1, Math.ceil(from / 100)); m * 100 < Math.min(course, to); m += 1) {
      const d = m * 100
      g.moveTo(...this.point(d, -0.4)).lineTo(...this.point(d, -3)).stroke({ width: 4 / pxPerMeter, color: 0xff5a5f })
      const label = this.markerLabel(used++)
      label.text = `${course - d}`
      const [lx, ly] = this.point(d, -5)
      label.position.set(lx, ly)
      label.scale.set(1 / pxPerMeter)
      label.rotation = -this.camera.angle
      label.visible = true
    }
    for (let i = used; i < this.markerLabels.length; i++) this.markerLabels[i]!.visible = false
  }

  /** The whole course in the bottom-right corner, with every runner's position. */
  private drawMinimap(width: number, height: number) {
    const g = this.minimap
    g.clear()
    const box = { x: width - MINIMAP.width - MINIMAP.margin, y: height - MINIMAP.height - MINIMAP.margin }
    g.roundRect(box.x, box.y, MINIMAP.width, MINIMAP.height, 10).fill({ color: INK, alpha: 0.45 })
    const bounds = courseBounds(this.path)
    const spanX = Math.max(1, bounds.maxX - bounds.minX)
    const spanY = Math.max(1, bounds.maxY - bounds.minY)
    const scale = Math.min((MINIMAP.width - MINIMAP.padding * 2) / spanX, (MINIMAP.height - MINIMAP.padding * 2) / spanY)
    const offsetX = box.x + (MINIMAP.width - spanX * scale) / 2
    const offsetY = box.y + (MINIMAP.height - spanY * scale) / 2
    const map = (distance: number): [number, number] => {
      const at = sampleCourse(this.path, distance)
      return [offsetX + (at.x - bounds.minX) * scale, offsetY + (bounds.maxY - at.y) * scale]
    }
    const course = this.timeline.courseDistance
    g.moveTo(...map(0))
    for (let d = 10; d < course; d += 10) g.lineTo(...map(d))
    g.lineTo(...map(course)).stroke({ width: 2, color: 0xffffff, alpha: 0.75 })
    g.circle(...map(course), 2.5).fill({ color: 0xffffff })
    this.frames.forEach((frame, index) => {
      if (index === this.playerIndex) return
      g.circle(...map(frame.distance), 2).fill({ color: 0xffffff, alpha: 0.85 })
    })
    const you = this.frames[this.playerIndex]
    if (you) g.circle(...map(you.distance), 3.5).fill({ color: PLAYER }).stroke({ width: 1, color: INK })
  }

  private markerLabel(index: number): Text {
    let label = this.markerLabels[index]
    if (!label) {
      label = new Text({
        text: '',
        style: { fontFamily: 'M PLUS Rounded 1c, system-ui, sans-serif', fontSize: 11, fontWeight: '800', fill: 0xffffff, stroke: { color: INK, width: 3 } },
      })
      label.anchor.set(0.5)
      this.markerLayer.addChild(label)
      this.markerLabels.push(label)
    }
    return label
  }
}
