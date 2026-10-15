// The Trophy Hall's last visit on this device (T141 "Trophy Hall"; docs/game/01-game-loop.md §4.2: device
// conveniences live in `uma-racer:g2:` keys): its counter is the flair earned since. A tiny module, so the counter's
// hook in the shell's entry reads it without the Trophy Hall's chunk.

export const TROPHY_HALL_SEEN_KEY = 'uma-racer:g2:trophy-hall-seen'

/** When this device last opened the Trophy Hall, or 0 when it never has (every flair event is then new). */
export function readSeen(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(TROPHY_HALL_SEEN_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function writeSeen(at: number): void {
  try {
    globalThis.localStorage?.setItem(TROPHY_HALL_SEEN_KEY, String(at))
  } catch {
    // A visit that can't be remembered leaves the counter as it was.
  }
}
