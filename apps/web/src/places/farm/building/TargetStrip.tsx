// Only the planner's labels, gates and links are Racer-owned; the strip is shared (SC5).
import { TargetsStrip } from '@luismlorenzana/uma-kit/work'
import type { TargetLineView } from './model'

export function TargetStrip({ lines, sheetTo, className }: {
  lines: readonly TargetLineView[]; sheetTo: (line: TargetLineView) => string; className?: string
}) {
  return <TargetsStrip className={className} targets={lines.map((line) => ({
    id: line.line.item, item: line.line.item, short: line.line.short, label: line.words, locked: line.gate, to: sheetTo(line),
  }))} />
}
