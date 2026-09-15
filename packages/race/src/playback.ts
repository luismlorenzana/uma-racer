// Interpolates a timeline at any elapsed time, so renderers can play races back at the display's refresh rate.
import type { RaceTimeline } from './types'

export interface RunnerFrame {
  distance: number
  speed: number
  hp: number
}

/** Samples every runner at `seconds` since the gate opened, writing into `out` to avoid per-frame allocations. */
export function sampleTimeline(timeline: RaceTimeline, seconds: number, out: RunnerFrame[]): RunnerFrame[] {
  const position = Math.max(0, Math.min(timeline.ticks - 1, seconds * timeline.tickRate))
  const t0 = Math.floor(position)
  const t1 = Math.min(timeline.ticks - 1, t0 + 1)
  const alpha = position - t0
  const n = timeline.runnerCount
  for (let r = 0; r < n; r++) {
    const a = t0 * n + r
    const b = t1 * n + r
    const frame = out[r] ?? (out[r] = { distance: 0, speed: 0, hp: 1 })
    frame.distance = timeline.distance[a]! + (timeline.distance[b]! - timeline.distance[a]!) * alpha
    frame.speed = timeline.speed[a]! + (timeline.speed[b]! - timeline.speed[a]!) * alpha
    frame.hp = timeline.hp[a]! + (timeline.hp[b]! - timeline.hp[a]!) * alpha
  }
  out.length = n
  return out
}

export const timelineDuration = (timeline: RaceTimeline): number => (timeline.ticks - 1) / timeline.tickRate
