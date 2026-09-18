// Pure race-catalog normalization (docs/design/racing.md).

import {
  distanceCategory,
  type RaceDirection,
  type RaceGrade,
  type RaceTemplate,
  type Surface,
} from '@racer/domain'
import { id, number as numberValue, records, text, type NormalizeResult } from './shared'

export const VENUES_BY_TRACK_ID: Readonly<Record<string, string>> = {
  '10001': 'Sapporo',
  '10002': 'Hakodate',
  '10003': 'Niigata',
  '10004': 'Fukushima',
  '10005': 'Nakayama',
  '10006': 'Tokyo',
  '10007': 'Chukyo',
  '10008': 'Kyoto',
  '10009': 'Hanshin',
  '10010': 'Kokura',
  '10101': 'Ohi',
  '10103': 'Kawasaki',
  '10104': 'Funabashi',
  '10105': 'Morioka',
  '10201': 'Longchamp',
}

const GRADES: Record<number, RaceGrade> = { 100: 'g1', 200: 'g2', 300: 'g3', 400: 'op', 700: 'pre-op' }
const SURFACES: Record<number, Surface> = { 1: 'turf', 2: 'dirt' }
const DIRECTIONS: Record<number, RaceDirection> = { 1: 'right', 2: 'left', 4: 'straight' }

export function normalizeRaces(value: unknown): NormalizeResult<RaceTemplate> {
  const warnings: string[] = []
  const items: RaceTemplate[] = []
  const seen = new Set<string>()

  for (const raw of records(value)) {
    const raceId = id(raw.id)
    const familyId = id(raw.race_id)
    if (!raceId || !familyId || !/^\d+$/.test(familyId) || seen.has(raceId)) continue
    const gradeCode = numberValue(raw.grade)
    const grade = gradeCode === null ? undefined : GRADES[gradeCode]
    if (!grade) {
      warnings.push(`Race ${raceId} has unsupported grade ${String(raw.grade)} and was skipped`)
      continue
    }
    const trackId = id(raw.track)
    const venue = trackId ? VENUES_BY_TRACK_ID[trackId] : undefined
    if (!venue) {
      warnings.push(`Race ${raceId} uses unsupported track ${trackId ?? '<missing>'} and was skipped`)
      continue
    }
    const surfaceCode = numberValue(raw.terrain)
    const directionCode = numberValue(raw.direction)
    const surface = surfaceCode === null ? undefined : SURFACES[surfaceCode]
    const direction = directionCode === null ? undefined : DIRECTIONS[directionCode]
    const distance = numberValue(raw.distance)
    const courseId = id(raw.course_id)
    const season = numberValue(raw.season)
    const entries = numberValue(raw.entries)
    const name = text(raw.name_en)
    if (!surface || !direction || distance === null || !courseId || season === null || entries === null || !name) {
      warnings.push(`Race ${raceId} has invalid required fields and was skipped`)
      continue
    }
    seen.add(raceId)
    items.push({
      id: raceId,
      familyId,
      name,
      grade,
      surface,
      distance,
      distanceCategory: distanceCategory(distance),
      direction,
      venue,
      courseId,
      season,
      fieldSize: Math.min(entries, 18),
    })
  }

  return { items, warnings }
}
