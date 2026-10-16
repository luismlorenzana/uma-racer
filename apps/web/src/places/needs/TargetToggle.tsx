// The target toggle (docs/game/02-check-ins-and-notifications.md §6 "Targets"; T142): **Mark as target** or **Remove
// target**, one `set-targets` with her added at the end or taken out. Past five, the rule says "Five targets at most."
// beside the button. It sits on her Needs tab, and in T138's profile header through `PROFILE_UI.TargetToggle`.
import { TargetIcon } from '@luismlorenzana/uma-kit/ui'
import { MAX_TARGETS } from '@racer/domain/planner'
import { useGame } from '../../app/game'
import { TapNoteLine } from '../../ui/work/TapNote'
import { useTap } from '../../ui/work/useTap'
import type { ProfileSlotProps } from '../registry'
import { markedTargets, toggledTargets } from './model'
import { needsWords } from './words'

export default function TargetToggle({ umaId }: ProfileSlotProps) {
  const state = useGame((snapshot) => snapshot.state)
  const tap = useTap()
  if (state === null || state.umas[umaId] === undefined) return null
  const marked = markedTargets(state)
  const at = marked.indexOf(umaId)
  const isTarget = at >= 0
  return (
    <div data-g2="target-toggle" className="flex max-w-44 shrink-0 flex-col items-end gap-1 text-right">
      <button
        type="button"
        aria-pressed={isTarget}
        disabled={tap.pending !== null}
        onClick={() => void tap.run('set-targets', { outfitIds: toggledTargets(marked, umaId) }, `targets:${umaId}`)}
        className={`font-display inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-3 text-[13px] font-semibold whitespace-nowrap shadow-1 disabled:opacity-45 ${
          isTarget ? 'border border-hairline-strong bg-panel text-ink' : 'bg-accent text-ink'
        }`}
      >
        <TargetIcon size={16} variant={isTarget ? 'duotone' : 'line'} />
        {needsWords(isTarget ? 'remove' : 'mark')}
      </button>
      {isTarget && <span className="text-[12px] font-semibold text-ink-soft">{needsWords('is-target', { n: at + 1, max: MAX_TARGETS })}</span>}
      <TapNoteLine tap={tap} className="text-[12px]" />
    </div>
  )
}
