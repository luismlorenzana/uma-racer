import { phaseAt, sampleTimeline, timelineDuration, type RaceTimeline, type RunnerFrame } from '@racer/race'
import { Application, Container, Graphics, Text } from 'pixi.js'

// Plays a pre-simulated race timeline back at the display's refresh rate (docs/technical/architecture.md#2-deterministic-simulation-then-playback).
// Horizontal straight track, lanes stacked vertically for portrait phones, camera that follows and zooms with the pack.

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
  playerDistance: number
  playerHp: number
  playerPosition: number
  /** Per runner, distance share 0–1, for the progress rail. */
  shares: number[]
  finished: boolean
}

interface Token {
  root: Container
  body: Graphics
  label: Text
  fontSize: number
}

const TURF_A = 0x4cb85a
const TURF_B = 0x45ab52
const RAIL = 0xffffff
const INK = 0x23324a
const STRIPE_METERS = 10
const HUD_INTERVAL_MS = 100

export class RaceScene {
  private readonly app = new Application()
  private destroyed = false
  private mounted = false
  private elapsed = 0
  private speed = 1
  private finishedNotified = false
  private hudTimer = 0
  private readonly duration: number
  private readonly frames: RunnerFrame[] = []
  private readonly camera = { center: 0, span: 70 }

  private readonly track = new Graphics()
  private readonly effects = new Graphics()
  private readonly runnerLayer = new Container()
  private readonly markerLabels: Text[] = []
  private readonly tokens: Token[] = []
  private readonly streaks = Array.from({ length: 10 }, (_, i) => ({ x: Math.random(), y: (i + 0.5) / 10, len: 0.15 + Math.random() * 0.2 }))

  constructor(
    private readonly timeline: RaceTimeline,
    private readonly runners: SceneRunner[],
    private readonly playerIndex: number,
    private readonly onHud: (state: RaceHudState) => void,
    private readonly onFinish: () => void,
  ) {
    this.duration = timelineDuration(timeline)
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
    this.app.stage.addChild(this.track, this.runnerLayer, this.effects)
    this.buildTokens()
    sampleTimeline(this.timeline, 0, this.frames)
    this.camera.center = this.frames[this.playerIndex]?.distance ?? 0
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS))
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  setSpeed(multiplier: number) {
    this.speed = multiplier
  }

  skipToEnd() {
    this.elapsed = this.duration
  }

  /** Jumps playback to `seconds` (replays, scrubbing, and dev tooling). */
  seek(seconds: number) {
    this.elapsed = Math.max(0, Math.min(this.duration, seconds))
  }

  destroy() {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.mounted) this.app.destroy({ removeView: true }, { children: true })
  }

  private readonly onVisibility = () => {
    if (document.hidden) this.app.ticker.stop()
    else this.app.ticker.start()
  }

  private buildTokens() {
    this.runners.forEach((runner) => {
      const root = new Container()
      const body = new Graphics()
      const label = new Text({
        text: runner.isPlayer ? '★' : runner.label,
        style: {
          fontFamily: 'M PLUS Rounded 1c, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: '800',
          fill: 0xffffff,
          stroke: { color: INK, width: 3 },
        },
      })
      label.anchor.set(0.5)
      root.addChild(body, label)
      this.runnerLayer.addChild(root)
      this.tokens.push({ root, body, label, fontSize: 12 })
    })
    // Player drawn last so it's never hidden behind rivals.
    const player = this.tokens[this.playerIndex]
    if (player) this.runnerLayer.addChild(player.root)
  }

  private update(deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000
    this.elapsed = Math.min(this.duration, this.elapsed + dt * this.speed)
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
    const targetSpan = Math.min(160, Math.max(45, lead - tail + 30))
    let targetCenter = (lead + tail) / 2
    const half = targetSpan / 2 - 6
    if (player.distance < targetCenter - half) targetCenter = player.distance + half
    if (player.distance > targetCenter + half) targetCenter = player.distance - half
    // Snap on big jumps (seek/skip) instead of panning across the whole course.
    const ease = Math.abs(targetCenter - this.camera.center) > this.camera.span * 2 ? 1 : 1 - Math.exp(-dt * 4)
    this.camera.span += (targetSpan - this.camera.span) * ease
    this.camera.center += (targetCenter - this.camera.center) * ease

    const pxPerMeter = width / this.camera.span
    const left = this.camera.center - this.camera.span / 2
    const toX = (meters: number) => (meters - left) * pxPerMeter

    // Lanes
    const laneCount = this.runners.length
    // Top margin leaves room for the remaining-distance labels above the rail.
    const trackTop = 36
    const trackHeight = height - trackTop - 18
    const laneHeight = Math.min(38, trackHeight / laneCount)
    const lanesTop = trackTop + (trackHeight - laneHeight * laneCount) / 2
    const radius = Math.max(8, Math.min(15, laneHeight * 0.42))

    this.drawTrack(width, height, left, pxPerMeter, toX, course, lanesTop, laneHeight * laneCount)

    // Runners
    const order = this.frames.map((f, i) => ({ d: f.distance, i })).sort((a, b) => b.d - a.d)
    const position = order.findIndex((o) => o.i === this.playerIndex) + 1
    this.runners.forEach((runner, i) => {
      const token = this.tokens[i]!
      const frame = this.frames[i]!
      const y = lanesTop + laneHeight * (runner.lane + 0.5)
      // A small stride bob while running gives the flat tokens some life.
      const running = frame.speed > 0.5 && frame.distance < course
      const bob = running ? Math.sin(this.elapsed * 14 + i) * 1.5 : 0
      token.root.position.set(toX(frame.distance), y + bob)
      token.body.clear()
      if (runner.isPlayer) token.body.circle(0, 0, radius + 4).fill({ color: 0xffc42e })
      token.body.circle(0, 0, radius).fill({ color: runner.color }).stroke({ width: 2.5, color: 0xffffff })
      // Low-HP warning ring
      if (frame.hp <= 0.001 && running) token.body.circle(0, 0, radius + 2).stroke({ width: 2, color: 0xff5a5f, alpha: 0.9 })
      const fontSize = Math.round(radius * 0.95)
      if (fontSize !== token.fontSize) {
        token.fontSize = fontSize
        token.label.style.fontSize = fontSize
      }
    })

    // Last-spurt speed streaks
    const phase = phaseAt(lead, course)
    this.effects.clear()
    if (phase >= 3 && this.elapsed < this.duration) {
      for (const streak of this.streaks) {
        streak.x -= dt * this.speed * 1.6
        if (streak.x + streak.len < 0) {
          streak.x = 1 + Math.random() * 0.3
          streak.y = Math.random()
        }
        const y = lanesTop + streak.y * laneHeight * laneCount
        this.effects
          .moveTo(streak.x * width, y)
          .lineTo((streak.x + streak.len) * width, y)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.35 })
      }
    }

    // HUD at ~10 Hz — React only re-renders the overlay this often.
    this.hudTimer += deltaMs
    const finished = this.elapsed >= this.duration
    if (this.hudTimer >= HUD_INTERVAL_MS || finished) {
      this.hudTimer = 0
      this.onHud({
        seconds: this.elapsed,
        duration: this.duration,
        phase,
        playerDistance: player.distance,
        playerHp: player.hp,
        playerPosition: position,
        shares: this.frames.map((f) => f.distance / course),
        finished,
      })
    }
    if (finished && !this.finishedNotified) {
      this.finishedNotified = true
      this.onFinish()
    }
  }

  private drawTrack(
    width: number,
    height: number,
    left: number,
    pxPerMeter: number,
    toX: (m: number) => number,
    course: number,
    lanesTop: number,
    lanesHeight: number,
  ) {
    const g = this.track
    g.clear()
    // Turf stripes anchored to the world, so movement reads even when the camera tracks the pack.
    const first = Math.floor(left / STRIPE_METERS)
    const last = Math.ceil((left + width / pxPerMeter) / STRIPE_METERS)
    for (let s = first; s <= last; s++) {
      g.rect(toX(s * STRIPE_METERS), 0, STRIPE_METERS * pxPerMeter + 1, height).fill({ color: s % 2 === 0 ? TURF_A : TURF_B })
    }
    // Rails
    g.rect(0, lanesTop - 8, width, 4).fill({ color: RAIL })
    g.rect(0, lanesTop + lanesHeight + 4, width, 4).fill({ color: RAIL })
    for (let s = first; s <= last; s++) {
      const x = toX(s * STRIPE_METERS)
      g.rect(x - 1.5, lanesTop - 14, 3, 10).fill({ color: RAIL })
      g.rect(x - 1.5, lanesTop + lanesHeight + 4, 3, 10).fill({ color: RAIL })
    }

    // Start gate and finish line
    if (toX(0) > -20 && toX(0) < width + 20) g.rect(toX(0) - 3, lanesTop - 6, 6, lanesHeight + 12).fill({ color: 0x9aa7b8 })
    const finishX = toX(course)
    if (finishX > -20 && finishX < width + 20) {
      const square = 6
      for (let row = 0; row * square < lanesHeight + 12; row++) {
        for (let col = 0; col < 2; col++) {
          g.rect(finishX - square + col * square, lanesTop - 6 + row * square, square, square).fill({
            color: (row + col) % 2 === 0 ? 0xffffff : INK,
          })
        }
      }
    }

    // Remaining-distance markers every 100 m (pooled labels)
    let used = 0
    const firstMarker = Math.max(1, Math.floor(left / 100))
    const lastMarker = Math.min(Math.floor(course / 100) - 1, Math.ceil((left + width / pxPerMeter) / 100))
    for (let m = firstMarker; m <= lastMarker; m++) {
      const x = toX(m * 100)
      g.rect(x - 2, lanesTop - 22, 4, 18).fill({ color: 0xff5a5f })
      const label = this.markerLabel(used++)
      label.text = `${course - m * 100}`
      label.position.set(x, lanesTop - 28)
      label.visible = true
    }
    for (let i = used; i < this.markerLabels.length; i++) this.markerLabels[i]!.visible = false
  }

  private markerLabel(index: number): Text {
    let label = this.markerLabels[index]
    if (!label) {
      label = new Text({
        text: '',
        style: { fontFamily: 'M PLUS Rounded 1c, system-ui, sans-serif', fontSize: 11, fontWeight: '800', fill: 0xffffff, stroke: { color: INK, width: 3 } },
      })
      label.anchor.set(0.5, 1)
      this.app.stage.addChild(label)
      this.markerLabels.push(label)
    }
    return label
  }
}
