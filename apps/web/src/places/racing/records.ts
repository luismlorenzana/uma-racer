// The records the Racing places read beyond the rules' state (T141): the snapshot's badge rows, with every race result
// and flair event read through the port's `logs` (T136 never loads logs into its store), re-read whenever the port
// publishes. Null until the first read lands, so a screen draws nothing rather than a wrong count.
import type { FlairEventV1 } from '@racer/domain'
import type { RaceResultRow } from '@racer/domain/save'
import { useEffect, useMemo, useState } from 'react'
import { flairKeyOf, type G2Game, type G2Records, useRuntime, useSnapshot } from '../../app/game'

interface Logs {
  readonly raceResults: Readonly<Record<string, RaceResultRow>>
  readonly flairEvents: Readonly<Record<string, FlairEventV1>>
}

/** Every race result and flair event, as the records key them. */
export async function readLogs(game: G2Game): Promise<Logs> {
  const [races, events] = await Promise.all([
    game.logs?.allRaceResults?.() ?? Promise.resolve([] as RaceResultRow[]),
    game.logs?.flairEvents?.() ?? Promise.resolve([] as FlairEventV1[]),
  ])
  return {
    raceResults: Object.fromEntries(races.map((row) => [row.opId, row])),
    flairEvents: Object.fromEntries(events.map((event) => [flairKeyOf(event), event])),
  }
}

export function useRecords(): G2Records | null {
  const { game } = useRuntime()
  const snapshot = useSnapshot()
  const [logs, setLogs] = useState<Logs | null>(null)
  useEffect(() => {
    if (snapshot.status !== 'ready') return
    let live = true
    readLogs(game).then((read) => { if (live) setLogs(read) }, () => {})
    return () => { live = false }
  }, [game, snapshot])
  const badges = snapshot.badges
  return useMemo(() => (logs === null ? null : { ...logs, badges: badges ?? {} }), [logs, badges])
}
