// This device's conveniences in Account (docs/game/02-check-ins-and-notifications.md §10; T138): never synced, in
// `uma-racer:g2:` keys. Reduced motion is T137's `motion.tsx` switch; the default race speed is read by T141's run.
import { useSyncExternalStore } from 'react'
import { REDUCED_MOTION_KEY, setDeviceReducedMotion } from '../app/motion'

export const RACE_SPEED_KEY = 'uma-racer:g2:raceSpeed'
/** Today's run offers 1× and 2× (`RaceRunScreen`'s time speeds); T141 keeps them. */
export const RACE_SPEEDS = [1, 2] as const
export type RaceSpeed = (typeof RACE_SPEEDS)[number]
const CHANGED = 'uma-racer:g2:device-prefs-changed'

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // The default stands.
  }
  globalThis.dispatchEvent?.(new Event(CHANGED))
}

export function raceSpeed(): RaceSpeed {
  const value = Number(read(RACE_SPEED_KEY))
  return RACE_SPEEDS.includes(value as RaceSpeed) ? (value as RaceSpeed) : 1
}

export const setRaceSpeed = (speed: RaceSpeed): void => write(RACE_SPEED_KEY, String(speed))

/** Account's own switch, apart from the system setting `useReducedMotionSetting` also reads. */
export const deviceReducedMotion = (): boolean => {
  const value = read(REDUCED_MOTION_KEY)
  return value === 'true' || value === '1'
}

export function setReducedMotion(on: boolean): void {
  setDeviceReducedMotion(on)
  globalThis.dispatchEvent?.(new Event(CHANGED))
}

function subscribe(listener: () => void): () => void {
  globalThis.addEventListener?.(CHANGED, listener)
  globalThis.addEventListener?.('storage', listener)
  return () => {
    globalThis.removeEventListener?.(CHANGED, listener)
    globalThis.removeEventListener?.('storage', listener)
  }
}

/** Both preferences, re-read whenever either changes on this device. */
export function useDevicePrefs(): { readonly reducedMotion: boolean; readonly raceSpeed: RaceSpeed } {
  const reducedMotion = useSyncExternalStore(subscribe, deviceReducedMotion, () => false)
  const speed = useSyncExternalStore(subscribe, raceSpeed, () => 1 as RaceSpeed)
  return { reducedMotion, raceSpeed: speed }
}
