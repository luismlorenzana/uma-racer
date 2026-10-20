// Check-in fitting is Racer's; the kit only draws and selects duration chips (SC5, D366).
import type { SizeRule } from '@luismlorenzana/uma-kit/work'
import { sizeChips } from '@racer/domain/check-in'

export function racerSizeRule(times: readonly number[], offset: number): SizeRule {
  return { mode: 'duration', recommend(start, seconds, max) {
    const fitted = sizeChips(start, seconds.slice(0, max), times, offset)
    return { size: fitted.marked, label: fitted.overnight ? 'runs overnight' : 'fits the next check-in', overnight: fitted.overnight,
      idleMs: Object.fromEntries(fitted.chips.map((chip) => [chip.size, chip.idleMs])) }
  } }
}
