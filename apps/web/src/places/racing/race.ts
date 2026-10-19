// Start race (T141 "The race commit"; docs/game/09-racing-rewards-and-exchange.md §8–§9; 01 §2): the race is settled
// when it starts, before playback. The attempt is prepared from the state as it stands, the timeline simulated, and
// `finish-race` applied locally with the placement, the day and the board the screen showed; its flair rides in the
// same transaction. The run page then plays the committed row (`?result=`), so quitting can't change the prize or the
// purse and a reopen lands on the same race. A refused or failed commit starts nothing (02 §9).
import type { Strategy } from '@racer/domain'
import type { OperationEnv } from '@racer/domain/check-in'
import type { WorkState } from '@racer/domain/work'
import type { LoadedContent } from '../../content/view'
import type { G2Applied, G2Game } from '../../app/game'
import { deviceRows, raceFlair } from './flair'
import { placementOf, prepareRace, raceRunOf, simulate } from './prepare'

export interface StartRace {
  readonly game: G2Game
  readonly state: WorkState
  readonly env: OperationEnv
  readonly content: LoadedContent
  readonly umaId: string
  readonly raceId: string
  readonly strategy: Strategy
  /** The device's date at Start race (09 §3.3). */
  readonly localDay: string
  /** The featured board the screen shows (09 §4). */
  readonly board: readonly string[]
}

export type StartAnswer = { readonly kind: 'done'; readonly id: string } | { readonly kind: 'failed' }

/** Results committed on this device in this visit: their first showing plays the fanfare; a reload shows them quietly. */
const fresh = new Set<string>()

/** Whether this result's fanfare is still to play; asking spends it. */
export function takeFanfare(id: string): boolean {
  return fresh.delete(id)
}

/** The busy key of her race: a second tap while the first commits gets its answer, never a second race. */
export const raceBusyKey = (umaId: string): string => `race:${umaId}`

/** The device's flair for a race that just applied (badges.md "Award and event semantics"). */
export const raceDevice = (content: LoadedContent, env: OperationEnv) => (applied: G2Applied<'finish-race'>) =>
  deviceRows(raceFlair({ state: applied.state, records: applied.records, content, env, now: applied.at }, applied.id))

export async function startRace(input: StartRace): Promise<StartAnswer> {
  const { game, umaId } = input
  try {
    // Her results so far, the queued ones included, read now: the seed's n (T141 "Prepare").
    const sequence = (await game.logs?.raceResults(umaId))?.length ?? 0
    const attempt = prepareRace({
      state: input.state, env: input.env, content: input.content, now: game.now(), umaId, raceId: input.raceId,
      strategy: input.strategy, sequence,
    })
    const timeline = simulate(attempt)
    const answer = await game.run('finish-race', {
      umaId, raceId: input.raceId, placement: placementOf(attempt, timeline), localDay: input.localDay, board: [...input.board],
      run: raceRunOf(input.content, attempt, timeline),
    }, raceBusyKey(umaId), { device: raceDevice(input.content, input.env) })
    if (answer.kind !== 'done') return { kind: 'failed' }
    if (!answer.repeated) fresh.add(answer.id)
    return { kind: 'done', id: answer.id }
  } catch {
    return { kind: 'failed' }
  }
}
