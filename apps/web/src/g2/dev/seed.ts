// Synthetic accounts for the dev mount (T137), picked by `?seed=`: every one is built by the rework's own operations on
// `rework/sim`'s invented content, never from the private packs. Later tasks add their seeds to `SEEDS` (T142's
// `stopped`). The Umas get invented display names with distinct initials, so a pip's fallback initial says who it is.
//
// - `busy` (the default): `createLoop` on BASELINE's policies with the roster at its cap of 25, through day 2. At day
//   3's 08:00 check-in every Uma is Ready; of the Farm's, the owner collects three in five and repeats their work, and
//   three of those queue the same again behind; one in five is collected and left Free; one in five stays Ready, as
//   every Training session does. The clock opens forty minutes on, so the rings show progress: Ready, Free, queued and
//   busy slots.
// - `fresh`: a new account (rework/13 §5): 20 Uma Tickets and nothing else.
// - `quiet`: the same loop through day 3's 08:00 check-in itself, a minute on: every Uma Working, nothing to collect.
import { nextCheckIn, repeat, type OperationEnv } from '@racer/domain/rework/check-in'
import {
  BASELINE, checkInsOn, createLoop, dayStart, loopRng, MS_PER_HOUR, MS_PER_MINUTE, SIM_CONTENT, SIM_UMAS, UTC_OFFSET_MIN, type LoopConfig,
} from '@racer/domain/rework/sim'
import { isRefusal, newAccount } from '@racer/domain/rework/tiers'
import { collect, newWorkState, queue, type WorkState } from '@racer/domain/rework/work'
import type { G2Sync } from '../app/game'

export interface G2Seed {
  readonly name: string
  readonly state: WorkState
  readonly env: OperationEnv
  /** Where the port's clock starts; it then runs with real time. */
  readonly at: number
  readonly trainerName: string
  readonly utcOffsetMin: number
  readonly sync: G2Sync
}

/** Invented names, one initial each, for the roster's first 25 synthetic Umas. */
const NAMES = [
  'Amber Sprint', 'Bluebell Dash', 'Cinder Gale', 'Dawn Meadow', 'Ember Stride', 'Fern Whistle', 'Gilded Comet', 'Harbor Light',
  'Ivory Lark', 'Juniper Run', 'Kestrel Bloom', 'Lantern Rise', 'Maple Rush', 'Nimbus Trail', 'Opal Breeze', 'Pepper Bell',
  'Quill Arrow', 'Rosy Horizon', 'Saffron Flash', 'Tidal Charm', 'Umber Spark', 'Velvet Lane', 'Willow Drift', 'Xenia Star', 'Yarrow Glen',
] as const

/** `rework/sim`'s content with the invented names: the same templates otherwise, so every rule reads them as the sim does. */
export const SEED_ENV: OperationEnv = Object.freeze({
  content: {
    ...SIM_CONTENT,
    umas: new Map([...SIM_CONTENT.umas].map(([id, template]) => {
      const index = SIM_UMAS.findIndex((uma) => uma.id === id)
      const name = NAMES[index]
      return [id, name === undefined ? template : { ...template, name }]
    })),
  },
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

function busy(): G2Seed {
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
  return seed('busy', state, CHECK_IN + 40 * MS_PER_MINUTE)
}

function fresh(): G2Seed {
  const at = dayStart(0) + 8 * MS_PER_HOUR
  return seed('fresh', newWorkState(newAccount(at)), at)
}

function quiet(): G2Seed {
  return seed('quiet', loopUntil(CHECK_IN + 1), CHECK_IN + MS_PER_MINUTE)
}

/** Every seed by name; the first is the default. */
export const SEEDS: Readonly<Record<string, () => G2Seed>> = Object.freeze({ busy, fresh, quiet })

const SEED_KEY = 'uma-racer:g2:dev-seed'
const SYNC_STATES: readonly G2Sync[] = ['synced', 'offline', 'paused', 'waiting', 'failing']

function remembered(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(SEED_KEY) ?? null
  } catch {
    return null
  }
}

function remember(name: string): void {
  try {
    globalThis.sessionStorage?.setItem(SEED_KEY, name)
  } catch {
    // A reload then opens the default seed.
  }
}

/**
 * The seed `?seed=` names (remembered for this tab, so a reload on any route keeps it), else `busy`; `?sync=` previews
 * the Sync chip's states.
 */
export function seedFor(search: string): G2Seed {
  const params = new URLSearchParams(search)
  const asked = params.get('seed')
  const name = [asked, remembered()].find((value): value is string => value !== null && value in SEEDS) ?? 'busy'
  if (asked !== null) remember(name)
  const sync = params.get('sync') as G2Sync | null
  const made = SEEDS[name]!()
  return sync !== null && SYNC_STATES.includes(sync) ? { ...made, sync } : made
}
