// Lazy adapter for the existing Training route. No kitchen imports in the startup shell.
import { useEffect, useState } from 'react'
import { db } from '../../game/db'
import { gameRuntime } from '../../game/runtime'
import type { FarmKitchenHost } from '../../game/farm/kitchen/host'
import { ScreenState } from '../../ui/ScreenState'
import { useTraining } from '../TrainingScene'
import { FarmExtraStatsScreen } from './FarmExtraStatsScreen'

export default function FarmExtraStatsProduction() {
  const training = useTraining(), [host, setHost] = useState<FarmKitchenHost | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => { let live = true; void gameRuntime.farmKitchenHost().then(h => { if (live) setHost(h) }).catch(e => { if (live) setError(String(e)) }); return () => { live = false } }, [])
  if (!host) return <ScreenState title={error ? 'Farm needs attention' : 'Opening meal map…'} detail={error ?? 'Reading the acknowledged Farm generation.'} />
  return <FarmExtraStatsScreen database={db} host={host} content={training.content} uma={training.save} cards={training.cards}
    tier={training.uma.tier} farmRoot="/farm" back={`/constellation/${encodeURIComponent(training.save.templateId)}`} />
}
