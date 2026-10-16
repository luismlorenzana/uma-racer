// This device's conveniences in Account (docs/game/02-check-ins-and-notifications.md §10; T138, T147): never synced, in
// `uma-racer:g2:` keys through uma-kit's device preferences. Reduce motion and Appearance are the kit's own switches
// (`app/kit.ts` gives them uma-racer's prefix); the default race speed is uma-racer's, read by T141's run.
import { deviceReducedMotion, readPref, setReducedMotion, subscribePrefs, writePref } from '@luismlorenzana/uma-kit/ui'
import { useSyncExternalStore } from 'react'
import { DEVICE_PREFIX } from '../app/kit'

export { deviceReducedMotion, setReducedMotion }

export const RACE_SPEED_KEY = `${DEVICE_PREFIX}raceSpeed`
/** Today's run offers 1× and 2× (`RaceRunScreen`'s time speeds); T141 keeps them. */
export const RACE_SPEEDS = [1, 2] as const
export type RaceSpeed = (typeof RACE_SPEEDS)[number]

export function raceSpeed(): RaceSpeed {
  const value = Number(readPref(RACE_SPEED_KEY))
  return RACE_SPEEDS.includes(value as RaceSpeed) ? (value as RaceSpeed) : 1
}

export const setRaceSpeed = (speed: RaceSpeed): void => writePref(RACE_SPEED_KEY, String(speed))

/**
 * The speed a run starts at: this phone's default when the race offers it, else the nearest speed it does offer (the
 * slower one on a tie). `offered` is the run's own list, such as a turn race's Slow, 1× and 2×.
 */
export function startingSpeed(offered: readonly number[], saved: number = raceSpeed()): number {
  let best = offered[0] ?? 1
  for (const value of offered) {
    const gap = Math.abs(value - saved) - Math.abs(best - saved)
    if (gap < 0 || (gap === 0 && value < best)) best = value
  }
  return best
}

/** Both preferences, re-read whenever either changes on this device. */
export function useDevicePrefs(): { readonly reducedMotion: boolean; readonly raceSpeed: RaceSpeed } {
  const reducedMotion = useSyncExternalStore(subscribePrefs, deviceReducedMotion, () => false)
  const speed = useSyncExternalStore(subscribePrefs, raceSpeed, () => 1 as RaceSpeed)
  return { reducedMotion, raceSpeed: speed }
}
