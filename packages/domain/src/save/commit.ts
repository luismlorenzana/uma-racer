// One tap, committed (D381). Every change to the account is an operation: an envelope with an id chosen before the tap
// is written, run at the device's time. The device applies it at once and queues it; the server re-runs the same
// function on its copy and stores what it gives. An applied commit writes the entities that changed, its race results
// and its `operations` row; a repeated id gives its first receipt and writes nothing; a refusal changes and stores
// nothing.
import { isOperationId, SAVE_LIMITS } from './kinds'
import { OPERATIONS } from './operations'
import { exactKeys, isJson, isObject, isTimestamp, jsonBytes } from './parse'
import { isRefusal, type OperationEnv, type Refusal } from './registry'
import { logDraft, type EntityDraft, type LogDraft } from './rows'
import { entityChanges, type SaveState } from './state'

/** One tap as it crosses the wire: its id, its operation's name, its input, and the device's time (the rules' `now`). */
export interface OperationEnvelope {
  readonly id: string
  readonly name: string
  readonly input: unknown
  readonly at: number
}

/** The envelope's shape and name; its input is a JSON value within the row bound, checked by the operation next. */
export function parseOperationEnvelope(value: unknown): OperationEnvelope | string {
  if (!isObject(value) || !exactKeys(value, ['id', 'name', 'input', 'at'])) return 'an operation is exactly { id, name, input, at }'
  if (!isOperationId(value.id)) return 'an operation id is 8-64 letters, digits, _ or -'
  if (typeof value.name !== 'string' || !OPERATIONS.has(value.name)) return `unknown operation ${String(value.name)}`
  if (!isTimestamp(value.at)) return 'an operation time is whole milliseconds'
  if (!isJson(value.input) || jsonBytes(value.input) > SAVE_LIMITS.rowBytes) return `an operation input is JSON of at most ${SAVE_LIMITS.rowBytes} bytes`
  return { id: value.id, name: value.name, input: value.input, at: value.at }
}

/** What a commit gives: applied with its rows, repeated with the first receipt and no rows, or refused. */
export type Commit =
  | {
    readonly status: 'applied'
    readonly state: SaveState
    readonly receipt: unknown
    readonly entities: readonly EntityDraft[]
    readonly logs: readonly LogDraft[]
  }
  | { readonly status: 'repeated'; readonly state: SaveState; readonly receipt: unknown; readonly entities: readonly []; readonly logs: readonly [] }
  | { readonly status: 'refused'; readonly refusal: Refusal }

/**
 * Commits one envelope on `state`. It throws on a caller's bug: a malformed id, an unknown name, an input the
 * operation's parser refuses, or an id reused under another name. The caller answers that tap `invalid`.
 */
export function commitOperation(state: SaveState, envelope: OperationEnvelope, env: OperationEnv): Commit {
  if (!isOperationId(envelope.id)) throw new RangeError(`Malformed operation id ${String(envelope.id)}`)
  if (!isTimestamp(envelope.at)) throw new RangeError('An operation needs a time')
  const def = OPERATIONS.get(envelope.name)
  if (def === undefined) throw new RangeError(`No operation ${String(envelope.name)}`)
  const done = state.operations?.[envelope.id]
  if (done !== undefined) {
    if (done.name !== envelope.name) throw new RangeError(`${envelope.id} ran as ${done.name}, not ${envelope.name}`)
    return { status: 'repeated', state, receipt: done.receipt, entities: [], logs: [] }
  }
  const input = def.parse(envelope.input)
  if (input === null) throw new RangeError(`Malformed ${envelope.name} input`)
  const result = def.apply(state, input as never, envelope.at, env, envelope.id)
  if (isRefusal(result)) return { status: 'refused', refusal: result }

  const record = { name: envelope.name, at: envelope.at, receipt: result.receipt ?? {} }
  const after: SaveState = { ...result.state, operations: { ...(result.state.operations ?? {}), [envelope.id]: record } }
  const races = result.raceResults ?? []
  const logs: LogDraft[] = races.map((race, n) =>
    logDraft('raceResults', races.length === 1 ? envelope.id : `${envelope.id}:${n + 1}`, race.at, race))
  logs.push(logDraft('operations', envelope.id, envelope.at, record))
  return { status: 'applied', state: after, receipt: record.receipt, entities: entityChanges(state, after), logs }
}
