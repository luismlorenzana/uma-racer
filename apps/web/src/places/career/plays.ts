// The season's Play, as this phone remembers it (D387): the best grade of each game settled for a career in its current
// season, so the season card can check its Play step. Device-only, like the stage journal: the save keeps no record of
// plays (each `settle-stage` pays and is done), and nothing hangs on it but the step's check. A new season forgets the
// last one's.
import { readPref, subscribePrefs, writePref } from '@luismlorenzana/uma-kit/ui'
import type { SettleStageReceipt, StageGrade, StageKind } from '@racer/domain/stages'
import { useSyncExternalStore } from 'react'
import { DEVICE_PREFIX } from '../../app/kit'

export const PLAYS_KEY = `${DEVICE_PREFIX}plays`

/** Per career: the season remembered, and each game's best grade in it. */
type Plays = Record<string, { readonly season: number; readonly grades: Partial<Record<StageKind, StageGrade>> }>

const RANK: readonly StageGrade[] = ['D', 'C', 'B', 'A', 'S']

function read(raw: string | null): Plays {
  if (raw === null) return {}
  try {
    const value = JSON.parse(raw) as unknown
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Plays : {}
  } catch {
    return {}
  }
}

/** Remembers a settled career play: its game's best grade in the season it was played in. */
export function recordPlay(receipt: Pick<SettleStageReceipt, 'careerId' | 'kind' | 'season' | 'grade' | 'practice'>): void {
  if (receipt.practice) return
  const plays = read(readPref(PLAYS_KEY))
  const kept = plays[receipt.careerId]
  const grades = kept?.season === receipt.season ? { ...kept.grades } : {}
  const before = grades[receipt.kind]
  if (before === undefined || RANK.indexOf(receipt.grade) > RANK.indexOf(before)) grades[receipt.kind] = receipt.grade
  writePref(PLAYS_KEY, JSON.stringify({ ...plays, [receipt.careerId]: { season: receipt.season, grades } }))
}

/** Each game's best grade this phone saw for the career in `season`. */
export function seasonPlays(raw: string | null, careerId: string, season: number): Partial<Record<StageKind, StageGrade>> {
  const kept = read(raw)[careerId]
  return kept?.season === season ? kept.grades : {}
}

/** The same, re-read whenever a preference changes on this phone. */
export function useSeasonPlays(careerId: string, season: number): Partial<Record<StageKind, StageGrade>> {
  const raw = useSyncExternalStore(subscribePrefs, () => readPref(PLAYS_KEY), () => null)
  return seasonPlays(raw, careerId, season)
}
