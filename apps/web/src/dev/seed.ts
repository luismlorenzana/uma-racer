// Synthetic accounts for the seeds' mount (T137; `/dev/seeds/*` in dev builds), picked by `?seed=`: every one is built by the rework's own operations on
// `@racer/domain/sim`'s invented content, never from the private packs. Later tasks add their seeds to `SEEDS`. The Umas get
// invented display names with distinct initials, so a pip's fallback initial says who it is.
//
// - `busy` (the default): `createLoop` on BASELINE's policies with the roster at its cap of 25, through day 2. At day
//   3's 08:00 check-in every Uma is Ready; of the Farm's, the owner collects three in five and repeats their work, and
//   three of those queue the same again behind; one in five is collected and left Free; one in five stays Ready, as
//   every Training session does. The clock opens forty minutes on, so the rings show progress: Ready, Free, queued and
//   busy slots.
// - `fresh`: a new account (rework/13 §5): 20 Uma Tickets and nothing else.
// - `quiet`: the same loop through day 3's 08:00 check-in itself, a minute on: every Uma Working, nothing to collect.
// - `gate` (T141): `busy` with two Umas jumped to their scenario's gate, every goal won, by the dev build's `dev-grant`:
//   the Scenario Gate's Advance sheet on a gate-ready Uma.
// - `promote` (T141, the dev proof of 04 §9): `busy` with two Umas taken through tier 1 by `dev-grant` and
//   `advance-scenario`, then through 04 §3's stand-in Expedition (`recordExpeditionRace`, eight wins), which nothing in
//   the game calls before phase 9: the first is Free, so Promote is enabled; the second is still working, so the
//   sheet offers Collect, Recall and −30m first.
// - `tired` and `spent` (T141): `busy` with today's Daily Purse past its first or second edge.
// - `stopped` (T142): `busy` with stock drained so queues dropped. At its 08:00 check-in the owner collects the Pantry,
//   and three Free Umas start Pantry jobs (Chopped Carrot, Carp Fillet and Apple Preserve, ×6 each) with more queued
//   behind them (Chopped Carrot ×10
//   then ×5, Carp Fillet ×10, Apple Preserve ×8); the owner then sells the Carrots, all but six Carp and the Apples,
//   and buys 12 Speed Tickets with part of the proceeds. The clock opens at 13:05: the three queues dropped at 12:03,
//   so Queue stopped offers Buy and restart, Start ×6 and Make them, and Prize Money and Speed Tickets are on hand for
//   Speed up.
// `?at=HH:MM` moves any seed's clock to that time of its own day, forward or back (T142).
import { devGrant, localMinute, nextCheckIn, OPERATIONS, repeat, type OperationEnv } from '@racer/domain/check-in'
import { buy, sell, sellPrice, SPEED_TICKET_PRICE } from '@racer/domain/economy'
import { SPEED_TICKET_ID } from '@racer/domain/items'
import {
  BASELINE, checkInsOn, createLoop, dayStart, loopRng, MS_PER_HOUR, MS_PER_MINUTE, SIM_CONTENT, SIM_UMAS, UTC_OFFSET_MIN, type LoopConfig,
} from '@racer/domain/sim'
import { EXPEDITION_WINS, isLastScenario, newAccount, recordExpeditionRace } from '@racer/domain/tiers'
import { isRefusal, type Refusal } from '@racer/domain/state'
import { collect, newWorkState, queue, slotHolder, slotsOf, start, type WorkState } from '@racer/domain/work'
import type { G2Records, G2Sync } from '../app/game'
import { withSyntheticSkills } from './skills'

export interface G2Seed {
  readonly name: string
  readonly state: WorkState
  readonly env: OperationEnv
  /** Where the port's clock starts; it then runs with real time. */
  readonly at: number
  readonly trainerName: string
  readonly utcOffsetMin: number
  readonly sync: G2Sync
  /** Race results, badges and flair the account starts with; none when absent. */
  readonly records?: G2Records
}

/** Invented names, one initial each, for the roster's first 25 synthetic Umas. */
const NAMES = [
  'Amber Sprint', 'Bluebell Dash', 'Cinder Gale', 'Dawn Meadow', 'Ember Stride', 'Fern Whistle', 'Gilded Comet', 'Harbor Light',
  'Ivory Lark', 'Juniper Run', 'Kestrel Bloom', 'Lantern Rise', 'Maple Rush', 'Nimbus Trail', 'Opal Breeze', 'Pepper Bell',
  'Quill Arrow', 'Rosy Horizon', 'Saffron Flash', 'Tidal Charm', 'Umber Spark', 'Velvet Lane', 'Willow Drift', 'Xenia Star', 'Yarrow Glen',
] as const

/**
 * `@racer/domain/sim`'s content with the invented names: the same templates otherwise, so every rule reads them as the sim
 * does, plus invented skills and card names (T138's `withSyntheticSkills`), which change no stat. `dev: true`, so
 * Account's dev section can run `dev-grant` on these synthetic accounts (M034).
 */
export const SEED_ENV: OperationEnv = Object.freeze({
  content: withSyntheticSkills({
    ...SIM_CONTENT,
    umas: new Map([...SIM_CONTENT.umas].map(([id, template]) => {
      const index = SIM_UMAS.findIndex((uma) => uma.id === id)
      const name = NAMES[index]
      return [id, name === undefined ? template : { ...template, name }]
    })),
  }),
  dev: true,
})

/** BASELINE's policies with the roster at its cap from day 0: BASELINE alone holds 20 Umas until Shards grow it. */
const CONFIG: LoopConfig = Object.freeze({ ...BASELINE, roster: Object.freeze({ kind: 'fixed', size: 25 } as const) })
const CHECK_IN = dayStart(3) + 8 * MS_PER_HOUR
const TRAINER = 'Hana'

/** The loop's account after every check-in strictly before `before`. */
function loopUntil(before: number): WorkState {
  const engine = createLoop(CONFIG, loopRng(CONFIG.seed))
  for (let day = 0; dayStart(day) < before; day += 1) {
    const times = checkInsOn(day, CONFIG.checkIns)
    times.forEach((now, i) => {
      if (now < before) engine.checkIn(now, i, times.length, nextCheckIn(now, CONFIG.checkIns, UTC_OFFSET_MIN))
    })
  }
  return engine.state()
}

const seed = (name: string, state: WorkState, at: number): G2Seed =>
  ({ name, state, env: SEED_ENV, at, trainerName: TRAINER, utcOffsetMin: UTC_OFFSET_MIN, sync: 'synced' })

/** The busy account's state at its check-in, with the Farm's Umas collected, repeated and queued as `busy` says. */
function busyState(): { readonly state: WorkState; readonly freed: readonly string[]; readonly again: readonly string[] } {
  let state = loopUntil(CHECK_IN)
  // Training sessions stay Ready, so the Training page has its pips and badge too.
  const inSession = (id: string) => state.work[id]?.entries.some((entry) => entry.request.kind === 'session') === true
  const ids = Object.keys(state.umas).sort().filter((id) => !inSession(id))
  const again = ids.filter((_, i) => i % 5 >= 1 && i % 5 <= 3)
  const freed = ids.filter((_, i) => i % 5 === 4)
  for (const outfitId of [...again, ...freed]) state = collect(state, { outfitId }, CHECK_IN, SEED_ENV).state
  const repeated = repeat(state, { outfitIds: again, utcOffsetMin: UTC_OFFSET_MIN }, CHECK_IN, SEED_ENV)
  state = repeated.state
  for (const line of repeated.receipt.started.slice(0, 3)) {
    const add = { request: line.request, building: line.slot.building, ...(line.slot.room === undefined ? {} : { room: line.slot.room }) }
    const queued = queue(state, { outfitId: line.outfitId, add }, CHECK_IN, SEED_ENV)
    if (!isRefusal(queued)) state = queued.state
  }
  return { state, freed, again }
}

const OPENS = CHECK_IN + 40 * MS_PER_MINUTE

function busy(): G2Seed {
  return seed('busy', busyState().state, OPENS)
}

/** The dev build's env: `dev-grant` runs only where it says `dev` (M034). */
const DEV_ENV: OperationEnv = Object.freeze({ ...SEED_ENV, dev: true })

/** Her scenario's gate with every goal won, by `dev-grant`. */
function atGate(state: WorkState, umaId: string, step: string): WorkState {
  const granted = devGrant(state, { gate: umaId }, CHECK_IN, DEV_ENV, `seed-${step}-${umaId}`)
  if (isRefusal(granted)) throw new Error(`The ${step} seed couldn't reach ${umaId}'s gate: ${granted.code}`)
  return granted.state
}

function gate(): G2Seed {
  const { state: busyAt, freed } = busyState()
  let state = busyAt
  for (const umaId of freed.slice(0, 2)) state = atGate(state, umaId, 'gate')
  return seed('gate', state, OPENS)
}

/** Through every scenario of her tier, then the stand-in Expedition's eight wins: a completed run (04 §3). */
function throughTier(start: WorkState, umaId: string): WorkState {
  let state = start
  for (let step = 0; !isLastScenario(state.umas[umaId]!); step += 1) {
    state = atGate(state, umaId, `tier-${step}`)
    const advanced = OPERATIONS['advance-scenario'](state, { umaId }, CHECK_IN, SEED_ENV)
    if (isRefusal(advanced)) throw new Error(`The promote seed couldn't advance ${umaId}: ${advanced.code}`)
    state = advanced.state
  }
  state = atGate(state, umaId, 'last')
  for (let win = 0; win < EXPEDITION_WINS; win += 1) {
    const raced = recordExpeditionRace(state, { umaId, expeditionId: 'dev-stand-in', won: true }, CHECK_IN)
    if (isRefusal(raced)) throw new Error(`The promote seed's Expedition refused ${umaId}: ${raced.code}`)
    state = raced.state
  }
  return state
}

function promote(): G2Seed {
  const { state: busyAt, freed, again } = busyState()
  let state = busyAt
  for (const umaId of [freed[0]!, again[0]!]) state = throughTier(state, umaId)
  return seed('promote', state, OPENS)
}

function fresh(): G2Seed {
  const at = dayStart(0) + 8 * MS_PER_HOUR
  return seed('fresh', newWorkState(newAccount(at)), at)
}

function quiet(): G2Seed {
  return seed('quiet', loopUntil(CHECK_IN + 1), CHECK_IN + MS_PER_MINUTE)
}

/** `busy` with today's Daily Purse already at `gross`: the purse bar and the prices past its edges (09 §3.5). */
function purseAt(name: string, gross: number): G2Seed {
  const state = busyState().state
  const day = new Date(OPENS + UTC_OFFSET_MIN * MS_PER_MINUTE).toISOString().slice(0, 10)
  return seed(name, { ...state, profile: { ...state.profile, purse: { day, gross, featuredPaid: [] } } }, OPENS)
}

/** The Pantry's Uma, Ready at 08:00: `stopped` collects her, so all three slots are free. */
const PANTRY_READY = 'sim-uma-01'

/** The Pantry jobs `stopped` starts at 08:00 with three Free Umas, ×6 each (ending at 12:03), and what it queues behind. */
const STARTED: readonly { readonly outfitId: string; readonly item: string; readonly queued: readonly number[] }[] = [
  { outfitId: 'sim-uma-01', item: 'chopped-carrot', queued: [10, 5] },
  { outfitId: 'sim-uma-15', item: 'carp-fillet', queued: [10] },
  { outfitId: 'sim-uma-20', item: 'apple-preserve', queued: [8] },
]
const STARTED_COUNT = 6

/** What `stopped` sells at 08:00, and how many of each it keeps. */
const DRAINED: readonly { readonly item: string; readonly keep: number }[] = [
  { item: 'carrot', keep: 0 }, { item: 'carp', keep: 6 }, { item: 'apple', keep: 0 },
]

/** Speed Tickets `stopped` buys: enough for 1 h and 2 h at 13:05, short of "to 22:30". */
const STOPPED_TICKETS = 12

function stopped(): G2Seed {
  let state = busyState().state
  const step = (result: { readonly state: WorkState } | Refusal) => {
    if (isRefusal(result)) throw new Error(`The stopped seed was refused: ${result.code}`)
    state = result.state
  }
  state = collect(state, { outfitId: PANTRY_READY }, CHECK_IN, SEED_ENV).state
  for (const { outfitId, item, queued } of STARTED) {
    const slot = slotsOf(state, 'pantry').find((one) => slotHolder(state, one) === undefined)
    if (slot === undefined) throw new Error('The stopped seed found no free Pantry slot')
    step(start(state, { outfitId, slot, request: { kind: 'craft', item, count: STARTED_COUNT } }, CHECK_IN, SEED_ENV))
    for (const count of queued) step(queue(state, { outfitId, add: { request: { kind: 'craft', item, count }, building: 'pantry' } }, CHECK_IN, SEED_ENV))
  }
  for (const { item, keep } of DRAINED) {
    step(sell(state, { opId: `seed-sell-${item}`, itemId: item, qty: (state.items[item] ?? 0) - keep, unitPrice: sellPrice(item)! }, CHECK_IN))
  }
  step(buy(state, { opId: 'seed-buy-tickets', sku: SPEED_TICKET_ID, qty: STOPPED_TICKETS, unitPrice: SPEED_TICKET_PRICE }, CHECK_IN))
  return seed('stopped', state, CHECK_IN + 5 * MS_PER_HOUR + 5 * MS_PER_MINUTE)
}

/** Every seed by name; the first is the default. */
export const SEEDS: Readonly<Record<string, () => G2Seed>> = Object.freeze({
  busy, fresh, quiet, gate, promote, tired: () => purseAt('tired', 6_420), spent: () => purseAt('spent', 13_100), stopped,
})

/** `?at=HH:MM`: the seed's clock moved to that minute of its own local day, or the seed as it is. */
export function seedAt(made: G2Seed, at: string | null): G2Seed {
  const match = at === null ? null : /^([01]\d|2[0-3]):([0-5]\d)$/.exec(at)
  if (match === null) return made
  const midnight = made.at - localMinute(made.at, made.utcOffsetMin) * MS_PER_MINUTE - (made.at % MS_PER_MINUTE)
  return { ...made, at: midnight + (Number(match[1]) * 60 + Number(match[2])) * MS_PER_MINUTE }
}

const SEED_KEY = 'uma-racer:g2:dev-seed'
const SYNC_STATES: readonly G2Sync[] = ['synced', 'offline', 'paused', 'waiting', 'failing']

function remembered(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(SEED_KEY) ?? null
  } catch {
    return null
  }
}

/** Remembers a seed for this tab, so a reload on any route reopens it (Account's dev section, T138). */
export const rememberSeed = (name: string): void => remember(name)

function remember(name: string): void {
  try {
    globalThis.sessionStorage?.setItem(SEED_KEY, name)
  } catch {
    // A reload then opens the default seed.
  }
}

/**
 * The seed `?seed=` names (remembered for this tab, so a reload on any route keeps it), else `busy`; `?sync=` previews
 * the Sync chip's states, and `?at=HH:MM` moves its clock (T142).
 */
export function seedFor(search: string): G2Seed {
  const params = new URLSearchParams(search)
  const asked = params.get('seed')
  const name = [asked, remembered()].find((value): value is string => value !== null && value in SEEDS) ?? 'busy'
  if (asked !== null) remember(name)
  const sync = params.get('sync') as G2Sync | null
  const made = seedAt(SEEDS[name]!(), params.get('at'))
  return sync !== null && SYNC_STATES.includes(sync) ? { ...made, sync } : made
}
