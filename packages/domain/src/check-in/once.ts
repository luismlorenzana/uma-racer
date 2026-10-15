// Every tap is one operation, applied once (docs/rework/02-check-ins-and-notifications.md §9; docs/rework/13-removals-
// and-plan-changes.md §6; docs/rework/07-farm.md §11). An operation carries an id chosen before it is written; `runOnce`
// returns the receipt stored under that id and changes nothing, or runs the operation and stores its first receipt in
// the `operations` log, so a retried Collect all or Repeat pays, reserves and starts nothing twice. A refusal changes
// nothing and stores nothing. `recheck` is the stale-screen rule: an action is checked against the latest state and
// then runs, shows the earlier result, or asks again in one sentence with the new numbers; never an error. After an
// operation applies, the Exchange's stock mark rises to the highest grade a current Farm Level opens (09 §5.3, D345):
// phase 3's collect commit, so every collect path (a collect, Collect all, Recall, Repeat, a start's collect-first)
// raises it on the device and the server alike, and the Farm's rules stay free of the Exchange (T140).
import { buy, farmLevelsOf, stockedGrade, type BuyInput } from '../economy/exchange'
import { sell, type SellInput } from '../economy/selling'
import type { ScenarioCatalogue } from '../tiers/map'
import type { TierContent } from '../tiers/career'
import { assertNow } from '../tiers/ledger'
import { induct, promote } from '../tiers/promotion'
import { exchangeShards, featureUma, setRaceDefaults, unlockUma } from '../tiers/roster'
import { advanceScenario, setActiveNodes, setAssignments, setCardSet, setLineage, setLoadout } from '../training/build'
import type { TrainingContent } from '../training/derive'
import { isRefusal, type OpResult, type Refusal } from '../state/types'
import type { WorkEnv } from '../work/kinds'
import { collect, finish, queue, recall, speedUp, start, upgrade, type QueueInput, type SpeedUpInput, type StartInput } from '../work/operations'
import { SESSION_KIND, type WorkRequest, type WorkState } from '../work/types'
import { setTargets } from '../planner/targets'
import { collectAll } from './collect-all'
import { devGrant, type DevGrantInput } from './dev-grant'
import { dismissDropped, restartDropped, type DismissInput, type RestartInput } from './dropped'
import { finishRace, type FinishRaceInput } from './finish-race'
import { repeat, setRepeatSizing } from './repeat'
import { setCheckInTimes } from './schedule'
import { speedUpAll, type SpeedUpAllInput } from './summary'
import { CHECK_IN_WORDS, say, type Words } from './words'

/** What every operation reads beyond the state: the content of all of them, and the work kinds if not the defaults. */
export interface OperationEnv extends WorkEnv {
  readonly content: TierContent & TrainingContent
  readonly catalogue?: ScenarioCatalogue
  /** True only in dev builds and on an API started with `DEV_OPERATIONS=true`: `dev-grant` runs nowhere else (M034). */
  readonly dev?: boolean
}

/**
 * Every owner action of 13 §6, by name, each `(state, input, now, env, id) → { state, receipt } | Refusal`. `start`,
 * `queue` and `speed-up` take T131's variants beside T127's inputs; `buy`, `sell`, `finish-race` and `dev-grant` take
 * their ledger ids from the operation's id, which is also the race result's.
 */
export const OPERATIONS = Object.freeze({
  start: (state: WorkState, input: StartInput | RestartInput, now: number, env: OperationEnv) =>
    ('from' in input ? restartDropped(state, input, now, env) : start(state, input, now, env)),
  queue: (state: WorkState, input: QueueInput | DismissInput, now: number, env: OperationEnv) =>
    ('dismiss' in input ? dismissDropped(state, input, now, env) : queue(state, input, now, env)),
  collect: (state: WorkState, input: { readonly outfitId: string }, now: number, env: OperationEnv) => collect(state, input, now, env),
  'collect-all': (state: WorkState, input: Parameters<typeof collectAll>[1], now: number, env: OperationEnv) => collectAll(state, input, now, env),
  repeat: (state: WorkState, input: Parameters<typeof repeat>[1], now: number, env: OperationEnv) => repeat(state, input, now, env),
  recall: (state: WorkState, input: { readonly outfitId: string }, now: number, env: OperationEnv) => recall(state, input, now, env),
  'speed-up': (state: WorkState, input: SpeedUpInput | SpeedUpAllInput, now: number, env: OperationEnv) =>
    ('all' in input ? speedUpAll(state, input, now, env) : speedUp(state, input, now, env)),
  finish: (state: WorkState, input: Parameters<typeof finish>[1], now: number, env: OperationEnv) => finish(state, input, now, env),
  upgrade: (state: WorkState, input: Parameters<typeof upgrade>[1], now: number, env: OperationEnv) => upgrade(state, input, now, env),
  'advance-scenario': (state: WorkState, input: Parameters<typeof advanceScenario>[1], now: number, env: OperationEnv) => advanceScenario(state, input, now, env),
  promote: (state: WorkState, input: Parameters<typeof promote>[1], now: number, env: OperationEnv) => promote(state, input, now, env),
  induct: (state: WorkState, input: Parameters<typeof induct>[1], now: number) => induct(state, input, now),
  buy: (state: WorkState, input: Omit<BuyInput, 'opId'>, now: number, _env: OperationEnv, id: string) => buy(state, { ...input, opId: id }, now),
  sell: (state: WorkState, input: Omit<SellInput, 'opId'>, now: number, _env: OperationEnv, id: string) => sell(state, { ...input, opId: id }, now),
  'unlock-uma': (state: WorkState, input: Parameters<typeof unlockUma>[1], now: number, env: OperationEnv) => unlockUma(state, input, now, env),
  'exchange-shards': (state: WorkState, input: Parameters<typeof exchangeShards>[1], now: number) => exchangeShards(state, input, now),
  'feature-uma': (state: WorkState, input: Parameters<typeof featureUma>[1], now: number) => featureUma(state, input, now),
  'set-race-defaults': (state: WorkState, input: Parameters<typeof setRaceDefaults>[1], now: number) => setRaceDefaults(state, input, now),
  'set-targets': (state: WorkState, input: Parameters<typeof setTargets>[1], now: number) => setTargets(state, input, now),
  'set-check-in-times': (state: WorkState, input: Parameters<typeof setCheckInTimes>[1], now: number) => setCheckInTimes(state, input, now),
  'set-repeat-sizing': (state: WorkState, input: Parameters<typeof setRepeatSizing>[1], now: number) => setRepeatSizing(state, input, now),
  'set-card-set': (state: WorkState, input: Parameters<typeof setCardSet>[1], now: number, env: OperationEnv) => setCardSet(state, input, now, env),
  'set-assignments': (state: WorkState, input: Parameters<typeof setAssignments>[1], now: number) => setAssignments(state, input, now),
  'set-lineage': (state: WorkState, input: Parameters<typeof setLineage>[1], now: number, env: OperationEnv) => setLineage(state, input, now, env),
  'set-active-nodes': (state: WorkState, input: Parameters<typeof setActiveNodes>[1], now: number) => setActiveNodes(state, input, now),
  'set-loadout': (state: WorkState, input: Parameters<typeof setLoadout>[1], now: number, env: OperationEnv) => setLoadout(state, input, now, env),
  'finish-race': (state: WorkState, input: FinishRaceInput, now: number, env: OperationEnv, id: string) => finishRace(state, input, now, env, id),
  'dev-grant': (state: WorkState, input: DevGrantInput, now: number, env: OperationEnv, id: string) => devGrant(state, input, now, env, id),
})

export type OperationName = keyof typeof OPERATIONS
export type OperationInput<N extends OperationName> = Parameters<(typeof OPERATIONS)[N]>[1]
export type OperationReceipt<N extends OperationName> = Exclude<ReturnType<(typeof OPERATIONS)[N]>, Refusal>['receipt']

/** One tap: its id, chosen before it is written, the operation's name and its input. */
export interface OperationCall<N extends OperationName = OperationName> {
  readonly id: string
  readonly name: N
  readonly input: OperationInput<N>
}

/** An operation's result through `runOnce`: `repeated` when the id had already run and its first receipt came back. */
export type OnceResult<R, S> = { readonly state: S; readonly receipt: R; readonly repeated: boolean } | Refusal

/**
 * Runs `call` once (02 §9, 13 §6): an id already in `state.operations` returns its stored receipt and the state as it
 * is; otherwise the operation runs and its receipt is stored under the id. The same id under another name is a
 * caller's bug and throws.
 */
export function runOnce<S extends WorkState, N extends OperationName>(state: S, call: OperationCall<N>, now: number, env: OperationEnv): OnceResult<OperationReceipt<N>, S> {
  assertNow(now)
  if (typeof call.id !== 'string' || call.id.length === 0) throw new RangeError('An operation needs an id')
  if (!Object.hasOwn(OPERATIONS, call.name)) throw new RangeError(`No operation ${String(call.name)}`)
  const done = state.operations?.[call.id]
  if (done !== undefined) {
    if (done.name !== call.name) throw new RangeError(`${call.id} ran as ${done.name}, not ${call.name}`)
    return { state, receipt: done.receipt as OperationReceipt<N>, repeated: true }
  }
  // Every operation is generic in the state it carries through, so S comes back as S; the table is typed at WorkState.
  const run = OPERATIONS[call.name] as unknown as (state: S, input: OperationInput<N>, now: number, env: OperationEnv, id: string) => OpResult<OperationReceipt<N>, S>
  const result = run(state, call.input, now, env, call.id)
  if (isRefusal(result)) return result
  const operations = { ...(result.state.operations ?? {}), [call.id]: { name: call.name, at: now, receipt: result.receipt } }
  return { state: { ...withStockMark(result.state), operations }, receipt: result.receipt, repeated: false }
}

/**
 * The state with the Exchange's stock mark raised to `stockedGrade` over every current Farm Level (09 §5.3, §10; D345).
 * Only a collect lifts a Farm Level, so it is a no-op after anything else; the mark never drops, promotion included.
 */
export function withStockMark<S extends WorkState>(state: S): S {
  const grade = stockedGrade(state.profile, farmLevelsOf(state))
  return grade === state.profile.exchangeGrade ? state : { ...state, profile: { ...state.profile, exchangeGrade: grade } }
}

/** What a screen shows after a tap (02 §9): a result, the earlier result, a question with new numbers, or a rule. */
export type Answer<N extends OperationName, S> =
  | { readonly kind: 'done'; readonly state: S; readonly receipt: OperationReceipt<N>; readonly repeated: boolean }
  /** "Only 3 left now. Start ×3?": one sentence, and the input that answers yes. */
  | { readonly kind: 'ask'; readonly question: Words; readonly input: OperationInput<N> }
  /** A real rule in plain words: "Kitasan Black is busy until 18:30." */
  | { readonly kind: 'say'; readonly words: Words }

const atSize = (request: WorkRequest, n: number): WorkRequest =>
  (request.kind === SESSION_KIND ? { ...request, unlocks: request.unlocks.slice(0, n) } : { ...request, count: n })

/**
 * The stale-screen rule (02 §9): the tap is checked against the latest state with the same rules. It runs; or shows
 * the result an earlier run of the same id gave; or, when the stock no longer covers the size picked, asks again with
 * the size it covers; or says the rule that stops it. Never an instruction to reload or retry.
 */
export function recheck<S extends WorkState, N extends OperationName>(state: S, call: OperationCall<N>, now: number, env: OperationEnv): Answer<N, S> {
  const result = runOnce(state, call, now, env)
  if (!isRefusal(result)) return { kind: 'done', ...result }
  const covers = result.data?.['largestCoverable']
  if (call.name === 'start' && result.code === 'short' && typeof covers === 'number' && covers > 0) {
    const input = call.input as OperationInput<'start'>
    const retry = 'from' in input ? { ...input, count: covers } : { ...input, request: atSize(input.request, covers) }
    return { kind: 'ask', question: say(CHECK_IN_WORDS['only-left'], { n: covers }), input: retry as OperationInput<N> }
  }
  return { kind: 'say', words: say(result.reason, result.data) }
}
