// The Careers place's view model (docs/game/11-hub-and-places.md §3.2; D386, D387): the careers as rows, a career's
// calendar strip, the season's step states, what Upgrade can buy now (its badge), a race's next attempt, a bond track's
// next stop, the cards a career's deck may take, the Umas free to start one, and the place's words. Pure: everything
// reads the save and the content handed in, and nothing reads a clock.
import type { RaceGrade, RaceTemplate, SupportCardTemplate, UmaTemplate } from '@racer/domain'
import { scenarioForTier } from '@racer/domain'
import {
  bondStops, bondToFill, bondValue, buySkill, campsOpen, deckWideTerms, extraBond, LONE_DECK, previewCamp, previewPip, readDeck, skillLibrary,
  type BondStop, type BuildView,
} from '@racer/domain/build'
import { OPEN_SCENARIOS, seasonName, seasonObjectives } from '@racer/domain/career'
import { careerSeasonLine, hubWords, nextObjective } from '@racer/domain/hub'
import {
  BOND_MAX, BRANCHES, careerId as careerIdOf, DECK_SIZE, FINALE_SEASON, SEASONS, bondId, isRefusal, isUnlocked,
  type CareerRecord, type OperationEnv, type RaceResultRecord, type SaveState,
} from '@racer/domain/save'
import { tierOf } from '@racer/domain/tiers'

export const CAREERS_WORDS = Object.freeze({
  'about-careers': 'A career is twelve seasons of Play, Upgrade and Race, then the URA Finals.',
  'about-season': 'Each season: play its game for drills, Bond and SP, spend them in Upgrade, then win its objectives to move on.',
  'about-replay': 'Play again opens either game at any time: a replay pays like a first play, and never moves the calendar.',
  'in-progress': 'In progress',
  completed: 'Completed',
  'none-running': 'No career running.',
  'to-stable': 'Open the Stable',
  objectives: 'Objectives',
  won: 'Won',
  open: 'Open',
  locked: 'Locked: win the round before it first',
  'unknown-career': "That career isn't in your save.",
  'racing-build': 'Her racing build',
  // Starting one.
  'start-career': 'Start a career',
  'pick-title': 'Who runs?',
  'pick-none': "Every Uma you own is in a career or has finished hers. Unlock another in the Stable.",
  'no-umas': 'No Uma in your Stable yet: unlock one with an Uma Ticket to start her career.',
  'start-confirm': 'Start career · URA Finale',
  'start-note': 'Twelve seasons, then the URA Finals. Her objectives are set now:',
  'start-failed': "Couldn't start the career. Try again.",
  // The career page.
  'play-again': 'Play again',
  'play-game': 'Play {game}',
  season: 'Season {n} of {of}',
  wallet: 'Wallet',
  drills: '{stat} drills',
  bond: 'Bond',
  sp: 'SP to spend',
  calendar: 'The calendar',
  'cell-done': 'done',
  'cell-now': 'now',
  'cell-ahead': 'ahead',
  'step-play': 'Play',
  'step-upgrade': 'Upgrade',
  'step-race': 'Race',
  'play-yard': 'Training Yard · {stat} focus',
  'play-furlong': 'Furlong Hand · prep heat on its course',
  'play-finale': 'Furlong Hand · prep heat on the URA Finals\' course',
  resume: 'Resume',
  played: 'Played · {grade}',
  'upgrade-count': '{n} to buy',
  'upgrade-none': 'Nothing affordable yet',
  'no-race': 'No race this season.',
  race: 'Race',
  'race-named': 'Race the {race}',
  'next-season': 'Next season',
  'to-finale': 'On to the URA Finals',
  'win-first': 'Win this season\'s races to move on.',
  'advance-failed': "Couldn't move on. Try again.",
  // The finale.
  finale: 'URA Finals',
  'finale-line': 'Three races at her best surface and distance, each retried until won.',
  round: 'Round {n}',
  // Completion.
  complete: 'URA Finale complete',
  'complete-line': 'Her racing build is frozen as she won the URA Finals.',
  'tickets-earned': 'Earned for the URA Finals',
  'uma-ticket': '+{n} Uma Ticket',
  'card-tickets': '+{n} Card Tickets',
  'next-scenario': 'Next: Unity Cup, coming in release 2',
  'her-profile': 'Her profile',
  // Upgrade.
  upgrade: 'Upgrade',
  'about-upgrade': 'Spend the wallet here: drills on her tree, Bond on her cards\' tracks, SP on skills. Every number is previewed before you buy.',
  'about-derived': 'What the tree pays is read from the deck as it stands, so changing a card or a post changes every pip at once.',
  'her-stats': 'Her stats now',
  tabs: 'Upgrade',
  'tab-tree': 'Tree',
  'tab-deck': 'Deck',
  'tab-bonds': 'Bonds',
  'tab-skills': 'Skills',
  'branch-line': '{branch}: level {level}, {pips} of {of} pips',
  affordable: 'next pip affordable',
  'next-pip': 'Next pip',
  'row-pips': 'The row: {n} pips',
  'buy-pip': 'Buy pip',
  'buy-row': 'Buy row',
  cost: '{n} drills',
  'needs-drills': 'Needs {n} more {branch} drills.',
  'branch-full': '{branch}\'s branch is complete.',
  camps: 'Camps',
  'camps-closed': 'Camps open once a branch reaches level 3.',
  'camp-slot': 'Camp {n}',
  'camp-in': 'Camp in {branch}: four level-5 sessions',
  'buy-camp': 'Buy Camp',
  'camps-full': 'Both Camps are bought.',
  deck: 'Her deck',
  'deck-slot': 'Empty slot',
  'deck-card': '{card}: trains at {branch}. Change its post',
  'deck-note': 'Tap a card to add it or take it out; tap a deck card to post it to another branch.',
  'deck-full': 'Her deck holds six: take one out to add another.',
  'no-cards': 'No cards for this career yet: unlock some in the Card Library.',
  'to-library': 'Open the Card Library',
  'card-types': 'Card type',
  'card-focus': 'Focus',
  'no-match': 'No card matches these filters.',
  'post-title': 'Trains at',
  'post-seats': '{n} of 5',
  'take-out': 'Take out of her deck',
  'bond-wallet': 'Bond to pour',
  'bond-of': '{card}: bond {value}',
  'next-hint': 'Next: hint · {skill} at {at}',
  'next-hint-plain': 'Next: a hint at {at}',
  'next-friendship': 'Next: friendship at {at}',
  'next-events': 'Next: her event skills at {at}',
  'bond-full': 'Full: friendship and every event skill',
  pour: 'Pour {n}',
  'pour-none': 'Pour',
  'no-deck': 'Set her deck first: each card brings its bond track.',
  'sp-left': '{left} of the {cap} SP cap left',
  bought: 'Bought',
  library: 'Her library',
  'no-library': 'Her own skills and every skill a card hints come here.',
  buy: 'Buy',
  'hint-level': 'Hint Lv {n}',
  // Races.
  'race-build': 'Her racing build',
  'race-style': 'Running style',
  'race-field': 'The field',
  'race-field-line': '{n} runners · {grade} field · her gate {gate}',
  'race-skills': 'Her skills',
  'no-skills': 'No skills bought yet: her unique races on its own.',
  'race-failed': "Couldn't run the race. Try again.",
  // A race's run and result.
  'run-back': 'Back to her career',
  skip: 'Skip to the finish',
  pause: 'Pause',
  'play-run': 'Play',
  speed: 'Playback speed',
  'phase-0': 'Opening leg',
  'phase-1': 'Middle leg',
  'phase-2': 'Final leg',
  'phase-3': 'Last spurt',
  'meters-left': '{m} m to go',
  hp: 'HP',
  win: 'Win!',
  'objective-won': 'Objective won',
  'not-won': 'Not won yet: retries are free.',
  'round-won': 'On to the {round}',
  'final-won': 'The URA Finals are hers',
  earned: 'Earned',
  'earned-card': '+{n} Card Ticket',
  'earned-sp': '+{n} SP',
  retry: 'Retry',
  continue: 'Continue',
  'finishing-order': 'Finishing order',
  'no-run': "That race isn't on this phone yet.",
} as const)

/** "1st", "2nd", "13th". */
export const ordinal = (n: number): string =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`

export type CareersWord = keyof typeof CAREERS_WORDS

export const careersWords = (key: CareersWord, data?: Readonly<Record<string, string | number>>): string =>
  CAREERS_WORDS[key].replace(/\{(\w+)\}/g, (whole, name: string) => (data !== undefined && Object.hasOwn(data, name) ? String(data[name]) : whole))

export const GRADE_LABEL: Readonly<Record<RaceGrade, string>> = { debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1' }

/** A race by name and grade, "Sim Cup (G1)", or its id while the content lacks it. */
export function raceLabel(raceId: string, races: readonly RaceTemplate[]): string {
  const race = races.find((each) => each.id === raceId)
  return race === undefined ? raceId : `${race.name} (${GRADE_LABEL[race.grade]})`
}

// --- The careers --------------------------------------------------------------------------------------------------

/** One career as a row. */
export interface CareerRow {
  readonly id: string
  readonly umaId: string
  readonly name: string
  /** "URA Finale · Classic Spring", or the scenario alone once complete. */
  readonly where: string
  /** "Next: Sim Cup (G1)", "Next: the URA Finals", or null once complete. */
  readonly next: string | null
  readonly completed: boolean
}

export function careerRow(id: string, career: CareerRecord, names: ReadonlyMap<string, { readonly name: string }>, races: readonly RaceTemplate[]): CareerRow {
  const completed = career.completedAt !== null
  const next = nextObjective(career)
  return {
    id,
    umaId: career.umaId,
    name: names.get(career.umaId)?.name ?? career.umaId,
    where: completed ? scenarioForTier(career.T)?.name ?? `Scenario ${career.T}` : careerSeasonLine(career),
    next: completed ? null : next === null ? hubWords('next-finale') : hubWords('next-objective', { race: raceLabel(next.raceId, races) }),
    completed,
  }
}

/** Every career as rows: in progress (the latest started first) and completed (the latest completed first). */
export function careerRows(careers: Readonly<Record<string, CareerRecord>>, names: ReadonlyMap<string, { readonly name: string }>, races: readonly RaceTemplate[]): {
  readonly running: CareerRow[]
  readonly completed: CareerRow[]
} {
  const entries = Object.entries(careers)
  const running = entries.filter(([, career]) => career.completedAt === null)
    .sort(([a, left], [b, right]) => right.startedAt - left.startedAt || a.localeCompare(b))
  const completed = entries.filter(([, career]) => career.completedAt !== null)
    .sort(([a, left], [b, right]) => right.completedAt! - left.completedAt! || a.localeCompare(b))
  return {
    running: running.map(([id, career]) => careerRow(id, career, names, races)),
    completed: completed.map(([id, career]) => careerRow(id, career, names, races)),
  }
}

/** A season's name for an objective's row. */
export const objectiveSeason = (season: number): string => seasonName(season)

/** The scenario a new career runs in: this release's only one, URA Finale (T = 1). */
export const START_T = OPEN_SCENARIOS[0]!

/**
 * The owned Umas free to start a career, newest unlock first: none in a career, none whose URA Finale career is done,
 * and only Umas the content holds.
 */
export function freeUmas(state: Pick<SaveState, 'umas' | 'careers'>, umas: ReadonlyMap<string, UmaTemplate>): UmaTemplate[] {
  const busy = new Set(Object.values(state.careers).filter((career) => career.completedAt === null).map((career) => career.umaId))
  return Object.entries(state.umas)
    .sort(([a, left], [b, right]) => right.unlockedAt - left.unlockedAt || a.localeCompare(b))
    .flatMap(([id]) => {
      const uma = umas.get(id)
      return uma === undefined || busy.has(id) || state.careers[careerIdOf(id, START_T)] !== undefined ? [] : [uma]
    })
}

// --- The calendar strip -------------------------------------------------------------------------------------------

export type CellState = 'done' | 'now' | 'ahead'

/** One season on the strip: its state and the objectives that fall in it. */
export interface CalendarCell {
  readonly season: number
  readonly name: string
  readonly state: CellState
  readonly objectives: readonly { readonly raceId: string; readonly grade: RaceGrade | null; readonly won: boolean }[]
}

/** The strip: the 12 seasons and the Finale, each done, now or ahead (a completed career's every cell is done). */
export function calendarCells(career: Pick<CareerRecord, 'season' | 'objectives' | 'completedAt'>, races: readonly RaceTemplate[]): CalendarCell[] {
  return Array.from({ length: SEASONS + 1 }, (_, season): CalendarCell => ({
    season,
    name: seasonName(season),
    state: career.completedAt !== null || season < career.season ? 'done' : season === career.season ? 'now' : 'ahead',
    objectives: season === FINALE_SEASON ? [] : career.objectives.filter((objective) => objective.season === season).map((objective) => ({
      raceId: objective.raceId,
      grade: races.find((race) => race.id === objective.raceId)?.grade ?? null,
      won: objective.status === 'won',
    })),
  }))
}

/** A cell's VoiceOver line: "Classic Spring, now: Sim Cup (G1), open". */
export function cellLabel(cell: CalendarCell, races: readonly RaceTemplate[]): string {
  const state = careersWords(cell.state === 'done' ? 'cell-done' : cell.state === 'now' ? 'cell-now' : 'cell-ahead')
  const objectives = cell.objectives.map((objective) => `${raceLabel(objective.raceId, races)}, ${careersWords(objective.won ? 'won' : 'open').toLowerCase()}`)
  return `${cell.name}, ${state}${objectives.length > 0 ? `: ${objectives.join('; ')}` : ''}`
}

/** The season's objectives still open. */
export const openObjectives = (career: Pick<CareerRecord, 'objectives' | 'season'>) =>
  seasonObjectives(career).filter((objective) => objective.status !== 'won')

// --- Upgrade: what can be bought now ----------------------------------------------------------------------------

export interface UpgradeCounts {
  /** Branches whose next pip she can afford, and one more when a Camp is affordable. */
  readonly tree: number
  /** Empty deck slots her owned cards can fill. */
  readonly deck: number
  /** Deck cards whose next bond stop the wallet's Bond reaches. */
  readonly bonds: number
  /** Skills she can buy now. */
  readonly skills: number
  readonly total: number
}

/** The view the build reads for a career. */
export const buildView = (career: Pick<CareerRecord, 'umaId'>, state: Pick<SaveState, 'bonds'>, env: OperationEnv): BuildView | null => {
  const uma = env.content.umas.get(career.umaId)
  return uma === undefined ? null : { uma, cards: env.content.cards, bonds: state.bonds }
}

/** The owned cards a career's deck may take: its era allows the scenario. Newest release first, then by title. */
export function allowedCards(state: Pick<SaveState, 'cards'>, cards: ReadonlyMap<string, SupportCardTemplate>, T: number): SupportCardTemplate[] {
  return Object.keys(state.cards).flatMap((id) => {
    const card = cards.get(id)
    return card === undefined || card.era > T || !isUnlocked(state.cards[id]) ? [] : [card]
  }).sort((a, b) => b.jpRelease.localeCompare(a.jpRelease) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

/** A deck card's track: its bond, its next stop and the Bond that reaches it (after any extra-bond unique). */
export interface TrackView {
  readonly cardId: string
  readonly value: number
  readonly stops: readonly BondStop[]
  /** The next stop above her bond; null once full. */
  readonly next: BondStop | null
  /** Bond a pour needs to reach the next stop. */
  readonly toNext: number
  /** Hints the track has given. */
  readonly hints: number
}

export function trackView(career: CareerRecord, state: Pick<SaveState, 'bonds'>, cards: ReadonlyMap<string, SupportCardTemplate>, cardId: string): TrackView | null {
  const card = cards.get(cardId)
  if (card === undefined) return null
  const deckWide = deckWideTerms(career.deck.flatMap((id) => cards.get(id) ?? []))
  const track = state.bonds[bondId(career.umaId, tierOf(career.T), cardId)]
  const value = bondValue(track, card, { ...LONE_DECK, deckWide })
  const stops = bondStops(card)
  const next = value >= BOND_MAX ? null : stops.find((stop) => stop.at > value) ?? null
  return {
    cardId, value, stops, next, hints: track?.hints ?? 0,
    toNext: next === null ? 0 : bondToFill(next.at - value, extraBond(career, cardId, cards)),
  }
}

export function upgradeCounts(career: CareerRecord, state: SaveState, env: OperationEnv): UpgradeCounts {
  const view = buildView(career, state, env)
  if (view === null || career.completedAt !== null) return { tree: 0, deck: 0, bonds: 0, skills: 0, total: 0 }
  const drills = career.wallet.drills
  let tree = BRANCHES.filter((branch) => {
    const pip = previewPip(career, view, branch)
    return pip !== null && pip.cost <= drills[branch]
  }).length
  if (campsOpen(career) && BRANCHES.some((branch) => {
    const camp = previewCamp(career, view, branch)
    return camp !== null && camp.cost <= drills[branch]
  })) tree += 1
  const spare = allowedCards(state, env.content.cards, career.T).filter((card) => !career.deck.includes(card.id)).length
  const deck = Math.min(DECK_SIZE - career.deck.length, spare)
  const bonds = readDeck(career, view).posted.filter(({ id }) => {
    const track = trackView(career, state, env.content.cards, id)
    return track !== null && track.next !== null && career.wallet.bond > 0 && career.wallet.bond >= track.toNext
  }).length
  const uma = env.content.umas.get(career.umaId)!
  const skills = skillLibrary(career, uma, env.content.cards, state.bonds, env.content.skills)
    .filter((entry) => !isRefusal(buySkill(career, view, uma, env.content.skills, entry.skillId))).length
  return { tree, deck, bonds, skills, total: tree + deck + bonds + skills }
}

// --- Races ---------------------------------------------------------------------------------------------------------

/**
 * The next attempt's number for a career race: one more than every run of that race in her career so far (a URA Finals
 * round counts every Finals run, as all three rounds run one course), so each Race and Retry is a new seeded race.
 * `ran` is the attempt just run, when known, so a retry never reuses it while the logs catch up.
 */
export function nextAttempt(rows: readonly RaceResultRecord[], careerId: string, kind: 'objective' | 'finale', raceId: string, ran: number | null = null): number {
  const runs = rows.filter((row) => row.careerId === careerId && row.kind === kind && row.raceId === raceId).length
  return Math.max(runs, ran === null ? 0 : ran + 1)
}
