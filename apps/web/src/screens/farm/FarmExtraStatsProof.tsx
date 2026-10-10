// Same real host/map/race builder on the isolated invented Farm database, never production.
import { DISTANCE_CATEGORIES, STATS, createPlayerProfile, parseUmaSave, type UmaSave } from '@racer/domain'
import { farmExtraVector } from '@racer/domain/farm/kitchen'
import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { farmProofContent, farmProofCards } from '../../game/farm/kitchen/proof-content'
import { FarmExtraStatsScreen } from './FarmExtraStatsScreen'
import { useKitchen } from './FarmKitchenScreen'
import { buildPreparedRace } from '../../game/racing'
import { Panel } from '../../ui/Panel'
const content = farmProofContent(), cards = farmProofCards()
export function FarmExtraStatsProof() {
  const { environment } = useKitchen(), [uma, setUma] = useState<UmaSave | null>(null)
  useEffect(() => { const sub = liveQuery(() => environment.database.umas.get('invented-0')).subscribe(row => setUma(row ? parseUmaSave(row.data) : null)); return () => sub.unsubscribe() }, [environment])
  if (!uma) return <p>Reading invented outfit…</p>
  return <div className="flex min-h-0 flex-1 flex-col"><button type="button" onClick={() => { void environment.prepareFullMapProof?.() }} className="min-h-11 shrink-0 rounded-sm border border-info px-2 text-xs">DEV only · prepare full-map/capacity witness</button><FarmExtraStatsScreen database={environment.database} host={environment.host} content={content} uma={uma} cards={cards}
    tier={1} farmRoot={environment.root} back={environment.root} renderRaceProof={map => <Panel className="mt-2 p-2"><p className="text-micro">Real pre-race builder · invented content</p>{DISTANCE_CATEGORIES.map(distance => {
      const vector = farmExtraVector(map.activeByScenario['ura-finale']?.[distance] ?? [])
      if (!vector.ok) throw new Error(vector.error.detail)
      const race = buildPreparedRace({ content, profile: createPlayerProfile('2000-01-01', 0), uma, cardsById: cards, raceId: `invented-race-${distance}`,
        strategy: 'pace', sequence: 0, tier: 1, farmStats: vector.value })
      return <p key={distance} className="text-[11px]">{distance[0]!.toUpperCase() + distance.slice(1)}: {STATS.map(stat => race.startStats[stat]).join(' / ')}</p>
    })}</Panel>} /></div>
}
