// Frozen preview / accepted movements, never an invented inventory balance (D250).
import { inspirationTokenName, type InspirationReward } from '@racer/domain'
import { InspirationTokenIcon } from '../InspirationTokenIcon'
export function RpgInspirationReward({ reward, label }: { reward: InspirationReward | null; label: string }) {
  if (!reward || reward.slot + reward.skill === 0) return null
  return <section aria-label={label} className="mt-3 space-y-2 rounded-sm border border-hairline-dark bg-stage-soft p-3">
    <h3 className="text-xs text-ink-on-dark-soft">{label}</h3>
    {(['slot', 'skill'] as const).filter(kind => reward[kind] > 0).map(kind => <div key={kind} className="flex items-center gap-2 text-xs">
      <InspirationTokenIcon kind={kind} size={32} /><span>+{reward[kind]} {inspirationTokenName(reward.tier, kind)}</span>
    </div>)}
  </section>
}
