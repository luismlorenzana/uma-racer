// Shared visual projection for Prestige frames (docs/design/badges.md).

import { prestigeFrame } from '@racer/domain'

export interface BadgeFrameStyle {
  index: number
  label: ReturnType<typeof prestigeFrame>['label']
  borderClass: string
  backgroundClass: string
  glyph: string
}

const FRAME_CLASSES: [string, string, string][] = [
  ['border-slate-200', 'bg-white', '◇'],
  ['border-amber-600', 'bg-amber-50', '◆'],
  ['border-slate-400', 'bg-slate-50', '◆'],
  ['border-gold', 'bg-amber-50', '✦'],
  ['border-cyan-400', 'bg-cyan-50', '✦'],
  ['border-violet-400', 'bg-violet-50', '✧'],
  ['border-fuchsia-500', 'bg-fuchsia-50', '★'],
]

export function badgeFrameStyle(prestige: number): BadgeFrameStyle {
  const frame = prestigeFrame(prestige)
  const classes = FRAME_CLASSES[frame.index]!
  return { ...frame, borderClass: classes[0], backgroundClass: classes[1], glyph: classes[2] }
}
