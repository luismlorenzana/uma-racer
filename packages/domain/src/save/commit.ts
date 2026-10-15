// One tap, committed (docs/rework/02-check-ins-and-notifications.md §8–§9, §11; docs/rework/13-removals-and-plan-
// changes.md §6; T134). Every change to the account is an operation: an envelope with an id chosen before the tap is
// written, run through `runOnce` at the device's time. The device applies it at once and queues it; the server re-runs
// the same function on its copy and stores what it gives. An applied commit writes the entities that changed and its
// logs; a repeated id gives its first receipt and writes nothing; a refusal changes and stores nothing.
import type { ItemLedgerEntry } from '../economy/ledger'
import type { FinishRaceInput } from '../check-in/finish-race'
import { OPERATIONS, runOnce, type OperationEnv, type OperationInput, type OperationName, type OperationReceipt } from '../check-in/once'
import { isRefusal, type Refusal } from '../state/types'
import type { ItemMovement } from '../work/types'
import { OPERATION_INPUTS } from './inputs'
import { isOperationId, SAVE_LIMITS } from './kinds'
import { exactKeys, isJson, isObject, isTimestamp, ITEM_LEDGER_SIGNS, jsonBytes } from './parse'
import { logDraft, type EntityDraft, type ItemLedgerRow, type LogDraft, type RaceResultRow } from './rows'
import { entityChanges, type SaveState } from './state'

/**
 * One tap as it crosses the wire: its id, chosen before the tap is written; its name; its input; and the device's time,
 * which is the operation's `now` (02 §8: the trusted-device clock). The input is checked by `OPERATION_INPUTS`, so a
 * malformed one is that tap's `invalid` and never the whole request's.
 */
export interface OperationEnvelope<N extends OperationName = OperationName> {
  readonly id: string
  readonly name: N
  readonly input: unknown
  readonly at: number
}

/** The envelope's shape and name; its input is a JSON value within the row bound, checked by `OPERATION_INPUTS` next. */
export function parseOperationEnvelope(value: unknown): OperationEnvelope | string {
  if (!isObject(value) || !exactKeys(value, ['id', 'name', 'input', 'at'])) return 'an operation is exactly { id, name, input, at }'
  if (!isOperationId(value.id)) return 'an operation id is 8-64 letters, digits, _ or -'
  if (typeof value.name !== 'string' || !Object.hasOwn(OPERATIONS, value.name)) return `unknown operation ${String(value.name)}`
  if (!isTimestamp(value.at)) return 'an operation time is whole milliseconds'
  if (!isJson(value.input) || jsonBytes(value.input) > SAVE_LIMITS.rowBytes) return `an operation input is JSON of at most ${SAVE_LIMITS.rowBytes} bytes`
  return { id: value.id, name: value.name as OperationName, input: value.input, at: value.at }
}

/** What a commit gives: applied with its rows, repeated with the first receipt and no rows, or refused. */
export type Commit<N extends OperationName = OperationName> =
  | {
    readonly status: 'applied'
    readonly state: SaveState
    readonly receipt: OperationReceipt<N>
    readonly entities: readonly EntityDraft[]
    readonly logs: readonly LogDraft[]
  }
  | { readonly status: 'repeated'; readonly state: SaveState; readonly receipt: OperationReceipt<N>; readonly entities: readonly []; readonly logs: readonly [] }
  | { readonly status: 'refused'; readonly refusal: Refusal }

/**
 * A receipt's Warehouse rows. Its own `itemLedger` rows (buy, sell, dev-grant) are kept as they are, with the
 * operation's id; each of its `movements` becomes `<opId>:m<n>`, negative for `reserve`, `cost` and `ticket` and positive
 * for `return` and `output`, at the moment it applied. `at`, the operation's time, dates a row that names none.
 */
export function itemLedgerRows(opId: string, receipt: unknown, at: number): ItemLedgerRow[] {
  if (!isObject(receipt)) return []
  const own = (Array.isArray(receipt.itemLedger) ? receipt.itemLedger : []) as readonly ItemLedgerEntry[]
  const moved = (Array.isArray(receipt.movements) ? receipt.movements : []) as readonly ItemMovement[]
  return [
    ...own.map((row): ItemLedgerRow => ({ id: row.id, itemId: row.itemId, delta: row.delta, reason: row.reason, outfitId: null, opId, at: row.at ?? at })),
    ...moved.map((move, n): ItemLedgerRow => ({
      id: `${opId}:m${n}`, itemId: move.item, delta: ITEM_LEDGER_SIGNS[move.kind] * move.qty, reason: move.kind, outfitId: move.outfitId, opId,
      at: move.at ?? at,
    })),
  ]
}

/**
 * A `finish-race` operation's `raceResults` row (09 §9): where she raced (her tier and scenario before it), the card set
 * of the preset of the race's distance as she raced it (after the operation's collect, which may bond a card first; the
 * race itself never changes her build), the run as the screen gave it, and the receipt. The device's store and the
 * server write the same row.
 */
export function raceResultRow(
  before: SaveState,
  after: SaveState,
  id: string,
  at: number,
  input: FinishRaceInput,
  receipt: OperationReceipt<'finish-race'>,
  env: OperationEnv,
): RaceResultRow {
  const her = before.umas[input.umaId]
  const raced = after.umas[input.umaId]
  if (her === undefined || raced === undefined) throw new RangeError(`No Uma ${input.umaId}`)
  const race = env.content.races.find((entry) => entry.id === input.raceId)
  if (race === undefined) throw new RangeError(`No race ${input.raceId}`)
  return {
    umaId: input.umaId, raceId: input.raceId, opId: id, at, tier: her.tier, scenario: her.scenario,
    cardSetIds: [...raced.build.presets[race.distanceCategory].cardSetIds], run: input.run, commit: receipt,
  }
}

/**
 * Commits one envelope on `state` (02 §9): `runOnce` at the envelope's time, then the rows it wrote. An applied commit's
 * entities are every one whose data changed; its logs are the new ledger rows (by id, after against before), the
 * receipt's item rows, the race's `raceResults` row for `finish-race` (with the tier and scenario she raced in), and the
 * `operations` row. It throws on a caller's bug: an input `OPERATION_INPUTS` refuses, an id reused under another name,
 * or an input a rule rejects as malformed. The caller answers that tap `invalid`.
 */
export function commitOperation<N extends OperationName>(state: SaveState, envelope: OperationEnvelope<N>, env: OperationEnv): Commit<N> {
  if (!isOperationId(envelope.id)) throw new RangeError(`Malformed operation id ${String(envelope.id)}`)
  const parse = OPERATION_INPUTS[envelope.name] as ((value: unknown) => OperationInput<N> | null) | undefined
  if (parse === undefined) throw new RangeError(`No operation ${String(envelope.name)}`)
  const input = parse(envelope.input)
  if (input === null) throw new RangeError(`Malformed ${envelope.name} input`)
  const result = runOnce(state, { id: envelope.id, name: envelope.name, input }, envelope.at, env)
  if (isRefusal(result)) return { status: 'refused', refusal: result }
  if (result.repeated) return { status: 'repeated', state: result.state, receipt: result.receipt, entities: [], logs: [] }

  const after = result.state
  const known = new Set(state.ledger.map((row) => row.id))
  const logs: LogDraft[] = after.ledger.filter((row) => !known.has(row.id)).map((row) => logDraft('ledger', row.id, row.at, row))
  for (const row of itemLedgerRows(envelope.id, result.receipt, envelope.at)) logs.push(logDraft('itemLedger', row.id, row.at, row))
  if (envelope.name === 'finish-race') {
    const row = raceResultRow(state, after, envelope.id, envelope.at, input as FinishRaceInput, result.receipt as OperationReceipt<'finish-race'>, env)
    logs.push(logDraft('raceResults', envelope.id, envelope.at, row))
  }
  logs.push(logDraft('operations', envelope.id, envelope.at, after.operations![envelope.id]!))
  return { status: 'applied', state: after, receipt: result.receipt, entities: entityChanges(state, after), logs }
}
