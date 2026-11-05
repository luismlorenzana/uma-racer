// A stage's seeded dice (D384): mulberry32, step for step `@racer/race`'s `createRng`, read as integers so nothing in
// a game's rules touches a float it didn't make itself. `below(n)` is exact for n < 2^21 (the product stays under 2^53).
// Pure.
import type { StageRng } from './contract'

export function stageRng(seed: number): StageRng {
  let state = seed >>> 0
  const nextInt = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  return {
    nextInt,
    below: (n) => {
      if (!Number.isSafeInteger(n) || n <= 0 || n > 0x200000) throw new RangeError('below(n) needs a whole n in 1 … 2^21')
      return Math.floor((nextInt() * n) / 4294967296)
    },
  }
}

/** Whether `value` can seed a play: an unsigned 32-bit integer. */
export const isStageSeed = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff

/** FNV-1a over a string, 32 bits: the golden-hash tests' fingerprint of a play. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}
