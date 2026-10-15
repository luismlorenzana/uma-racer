// The Racecourse's view models (docs/rework/09-racing-rewards-and-exchange.md §3.5, §4, §7; docs/rework/11-hub-and-
// places.md §3.3, §9.2; 03 §2): the Uma strip, the purse bar, today's featured board, the pre-race prize, and the
// result's lines. Pure: the rules give every number (`purseFor`, `bandAt`, `PURSE_BANDS`, `featuredBoard`,
// `grossPrize`, `payFromPurse`, the race finish's receipt), and the words are `words.ts`'s.
import { careerComplete, careerHoldLevel, CAREER_STAGE_LABELS, careerStage, regularRaceCatalog, type RaceGrade, type RaceTemplate } from '@racer/domain'
import { clockTime, hasReady } from '@racer/domain/check-in'
import {
  bandAt, boardDay, featuredBoard, featuredSeed, grossPrize, payFromPurse, purseFor, PURSE_BANDS, PURSE_SHARE_DENOMINATOR, WIN_PRIZE,
  type LocalDay, type PurseBand, type RacePrize,
} from '@racer/domain/economy'
import { BUILDINGS } from '@racer/domain/farm'
import { advanceReadiness, lifetimeLevel } from '@racer/domain/tiers'
import { isRefusal, type AccountProfile, type DailyPurse, type UmaState } from '@racer/domain/state'
import { endsAt, type WorkRow, type WorkState } from '@racer/domain/work'
import type { FinishRaceReceipt } from '@racer/domain/check-in'
import { createRng } from '@racer/race'
import { amount, ordinal, racingWords } from './words'

// ---- Shares and days ----------------------------------------------------------------------------------------------

const SHARE_WORDS: Readonly<Record<number, string>> = { 20: 'in full', 10: 'a half', 5: 'a quarter', 1: 'a twentieth' }

/** A band's share in words: "a quarter", "a twentieth" (09 §3.5), from its twentieths. */
export function shareWords(band: PurseBand): string {
  const rule = PURSE_BANDS.find((entry) => entry.band === band)!
  return SHARE_WORDS[rule.paidTwentieths] ?? `${rule.paidTwentieths}/${PURSE_SHARE_DENOMINATOR}`
}

const edgeOf = (band: PurseBand): number | null => PURSE_BANDS.find((entry) => entry.band === band)!.upTo

/** The device's local calendar date at `now`, `YYYY-MM-DD` (09 §3.3: the race's day is the day it starts). */
export function localDayAt(now: number, utcOffsetMin: number): LocalDay {
  return new Date(now + utcOffsetMin * 60_000).toISOString().slice(0, 10)
}

// ---- The purse bar (09 §3.5) ---------------------------------------------------------------------------------------

export interface PurseBar {
  readonly band: PurseBand
  readonly words: string
  /** How far through the band the day is, 0–1: a spent purse reads full. */
  readonly fill: number
  /** The (i)'s two lines. */
  readonly about: readonly [string, string]
}

/** The purse bar for `localDay`: a later day reads an empty purse, as the next race will start it. */
export function purseBar(purse: DailyPurse, localDay: LocalDay): PurseBar {
  const { gross } = purseFor(purse, localDay)
  const band = bandAt(gross)
  const [full, tired] = PURSE_BANDS
  const fullEdge = full!.upTo!
  const tiredEdge = tired!.upTo!
  const about = [
    racingWords('purse-about', { full: amount(fullEdge), tiredShare: shareWords('tired'), tired: amount(tiredEdge), spentShare: shareWords('spent') }),
    racingWords('purse-about-2'),
  ] as const
  if (band === 'full') return { band, words: racingWords('purse-full', { gross: amount(gross), edge: amount(fullEdge) }), fill: gross / fullEdge, about }
  if (band === 'tired') {
    return { band, words: racingWords('purse-tired', { share: shareWords('tired'), edge: amount(tiredEdge) }), fill: (gross - fullEdge) / (tiredEdge - fullEdge), about }
  }
  return { band, words: racingWords('purse-spent', { share: shareWords('spent') }), fill: 1, about }
}

// ---- Today's featured (09 §4) --------------------------------------------------------------------------------------

export interface FeaturedCard {
  readonly race: RaceTemplate
  /** Its win prize again, paid on the day's first win by any Uma. */
  readonly bonus: number
  readonly paid: boolean
}

export interface FeaturedView {
  /** The board's day: the later of the purse's and the device's (09 §8). */
  readonly day: LocalDay
  /** The race ids the screen shows, which a race carries into `finish-race`. */
  readonly board: readonly string[]
  readonly cards: readonly FeaturedCard[]
  /** Bonuses still open: the Racecourse's counter (0–3). */
  readonly open: number
}

/** The regular catalogue the draw reads: today's Race Select projection (D192), never an Expedition pool. */
export const regularCatalogue = (races: readonly RaceTemplate[]) =>
  regularRaceCatalog(races).map((race) => ({ id: race.id, grade: race.grade, distance: race.distanceCategory }))

export function featuredView(profile: Pick<AccountProfile, 'purse'>, localDay: LocalDay, races: readonly RaceTemplate[]): FeaturedView {
  const day = boardDay(profile.purse, localDay)
  const board = featuredBoard(day, regularCatalogue(races), createRng(featuredSeed(day)))
  const paid = new Set(purseFor(profile.purse, localDay).featuredPaid)
  const byId = new Map(races.map((race) => [race.id, race]))
  const cards = board.flatMap((id) => {
    const race = byId.get(id)
    return race ? [{ race, bonus: WIN_PRIZE[race.grade], paid: paid.has(id) }] : []
  })
  return { day, board, cards, open: cards.filter((card) => !card.paid).length }
}

// ---- The Uma strip (11 §9.2) ---------------------------------------------------------------------------------------

export interface StripTile {
  readonly umaId: string
  readonly name: string
  readonly tier: number
  readonly level: number
  readonly lifetime: number
  /** Her career has goals left: she leads the strip. */
  readonly open: boolean
  /** Her work in one chip ("Kitchen · 16:40"), or null when she is free. Never a lock (D328). */
  readonly work: string | null
}

/** Her work in one chip: where, and when it ends, or Ready. */
export function workChip(row: WorkRow | undefined, now: number, utcOffsetMin: number): string | null {
  const entry = row?.entries[row.entries.length - 1]
  const building = row?.slot?.building
  if (row === undefined || entry === undefined || building === undefined) return null
  const place = BUILDINGS[building].name
  return hasReady(row, now) ? racingWords('tile-ready', { place }) : racingWords('tile-work', { place, time: clockTime(endsAt(entry), utcOffsetMin) })
}

/**
 * The strip's order (11 §9.2): open goals first, then D181's order by lifetime level, highest first, then name; finished
 * careers last.
 */
export function stripOrder(state: Pick<WorkState, 'umas' | 'work'>, name: (umaId: string) => string, now: number, utcOffsetMin: number): StripTile[] {
  return Object.values(state.umas).map((uma): StripTile => ({
    umaId: uma.outfitId,
    name: name(uma.outfitId),
    tier: uma.tier,
    level: uma.racing.level,
    lifetime: lifetimeLevel(uma.tier, uma.racing.level),
    open: !careerComplete(uma.career),
    work: workChip(state.work[uma.outfitId] as WorkRow | undefined, now, utcOffsetMin),
  })).sort((a, b) => Number(b.open) - Number(a.open) || b.lifetime - a.lifetime || a.name.localeCompare(b.name) ||
    (a.umaId < b.umaId ? -1 : a.umaId > b.umaId ? 1 : 0))
}

/** Next Uma (09 §7): the one after her in the strip, round to the first. */
export function nextUma(strip: readonly StripTile[], umaId: string): string | null {
  if (strip.length === 0) return null
  const at = strip.findIndex((tile) => tile.umaId === umaId)
  return strip[(at + 1) % strip.length]!.umaId
}

// ---- The pre-race sheet's prize (09 §3.5) -------------------------------------------------------------------------

const GRADE_WORDS: Readonly<Record<RaceGrade, string>> = { debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1' }
export const gradeWords = (grade: RaceGrade): string => GRADE_WORDS[grade]

/** A win's prize at the current band: "G1 win · 300", or "G1 win · 75, tired purse". */
export function prizePreview(purse: DailyPurse, localDay: LocalDay, grade: RaceGrade): string {
  const gross = grossPrize({ grade, place: 1 })
  if (typeof gross !== 'number') throw new Error('A win always has a prize')
  const payment = payFromPurse(purse, localDay, gross)
  if (payment.paid >= gross) return racingWords('prize-full', { grade: gradeWords(grade), paid: amount(payment.paid) })
  return racingWords('prize-band', {
    grade: gradeWords(grade), paid: amount(payment.paid), band: racingWords(payment.band === 'spent' ? 'band-spent' : 'band-tired'),
  })
}

// ---- The result (09 §7) --------------------------------------------------------------------------------------------

/** "×1.2", "×1.33": the Race Bonus multiplier, two places at most. */
export const multiplier = (raceBonus: number): string => String(Math.round((1 + raceBonus) * 100) / 100)

/** Racing EXP with Race Bonus named: "+180 · G1 win ×1.2". */
export function expLine(finish: Pick<FinishRaceReceipt['finish'], 'expGained'>, grade: RaceGrade, placement: number, raceBonus: number): string {
  const line = placement === 1
    ? racingWords('exp-win', { exp: amount(finish.expGained), grade: gradeWords(grade) })
    : racingWords('exp-place', { exp: amount(finish.expGained), grade: gradeWords(grade), place: ordinal(placement) })
  return raceBonus > 0 && finish.expGained > 0 ? racingWords('exp-bonus', { line, mult: multiplier(raceBonus) }) : line
}

export interface PrizeLines {
  /** What flies into the account bar's chip: the purse's pay and any featured bonus. */
  readonly total: number
  readonly main: string
  /** Only the lines that applied. */
  readonly lines: readonly string[]
}

/** Prize Money (09 §7): "+300 · 1st in a G1", then the Expedition rate, the featured bonus, a tired or spent purse. */
export function prizeLines(prize: RacePrize, grade: RaceGrade, placement: number): PrizeLines {
  const lines: string[] = []
  if (prize.expedition) lines.push(racingWords('prize-expedition'))
  if (prize.featuredBonus > 0) lines.push(racingWords('prize-featured', { n: amount(prize.featuredBonus) }))
  if (prize.paid < prize.gross && prize.band !== 'full') {
    const edge = edgeOf(prize.band)
    lines.push(edge === null
      ? racingWords('prize-spent', { share: shareWords('spent'), gross: amount(prize.dayGross) })
      : racingWords('prize-tired', { share: shareWords('tired'), gross: amount(prize.dayGross), edge: amount(edge) }))
  }
  return {
    total: prize.paid + prize.featuredBonus,
    main: racingWords('prize-main', { paid: amount(prize.paid), place: ordinal(placement), grade: gradeWords(grade) }),
    lines,
  }
}

/** Her career's hold as a Racing Level, or null (03 §2): today's `careerHoldLevel` reads lifetime levels. */
export function holdLevel(uma: Pick<UmaState, 'tier' | 'racing' | 'career'>): number | null {
  const offset = lifetimeLevel(uma.tier, 1) - 1
  const hold = careerHoldLevel(uma.career, offset + uma.racing.level)
  return hold === null ? null : hold - offset
}

/** "Held at Lv 25 · win the Trials" while she sits on her hold; else null. */
export function holdLine(uma: Pick<UmaState, 'tier' | 'racing' | 'career'>): string | null {
  const hold = holdLevel(uma)
  const stage = careerStage(uma.career)
  if (hold === null || uma.racing.level < hold || stage === null) return null
  return racingWords('hold', { level: hold, stage: CAREER_STAGE_LABELS[stage] })
}

/** Advance joins the result's actions when she can advance now (03 §5). */
export const canAdvance = (uma: UmaState): boolean => !isRefusal(advanceReadiness(uma))

/** The result's EXP, level-ups and Shard, from the stored receipt: a reload shows exactly what was paid. */
export function finishLines(commit: FinishRaceReceipt, grade: RaceGrade, placement: number) {
  return {
    exp: expLine(commit.finish, grade, placement, commit.raceBonus),
    levels: commit.finish.levelsGained.map((level) => racingWords('level-up', { level })),
    shard: commit.finish.shardsPaid > 0 ? racingWords('gate-shard', { n: commit.finish.shardsPaid }) : null,
  }
}
