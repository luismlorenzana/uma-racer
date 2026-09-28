import { scenarioForTier, type UmaSave } from '@racer/domain'
import { chooseTier } from '../game/scenario-choice'

/**
 * Her trained units, one per unlocked scenario (D190): pick which one she uses. Shown only once she has more than one;
 * the current scenario, her career, is marked.
 */
export function ScenarioSwitch({ uma, tier, label = 'Scenario in use', className = '' }: {
  uma: UmaSave
  tier: number
  label?: string
  className?: string
}) {
  if (uma.scenarios.length < 2) return null
  const runs = [...uma.scenarios].sort((left, right) => right.tier - left.tier)
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] ${className}`}>
      {runs.map((run) => {
        const selected = run.tier === tier
        const current = run.tier === uma.unlockedTier
        return (
          <button
            key={run.tier}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => chooseTier(uma, run.tier)}
            className={`flex min-h-11 shrink-0 flex-col justify-center rounded-md border px-3 text-left transition-colors ${
              selected ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'
            }`}
          >
            <span className={`text-[13px] leading-tight font-semibold ${selected ? 'text-accent-strong' : 'text-ink'}`}>
              {scenarioForTier(run.tier)?.name ?? `Scenario ${run.tier}`}
            </span>
            <span className="text-micro leading-tight">TL {run.trainingLevel}{current ? ' · career' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}
