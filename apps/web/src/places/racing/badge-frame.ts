// Shared visual projection for Prestige frames (docs/design/badges.md).

import { GemIcon, type IconComponent, type IconVariant, SparkIcon, StarIcon } from '@luismlorenzana/uma-kit/ui'
import { prestigeFrame } from '@racer/domain'

export interface BadgeFrameStyle {
  index: number
  label: ReturnType<typeof prestigeFrame>['label']
  borderClass: string
  backgroundClass: string
  Glyph: IconComponent
  glyphVariant: IconVariant
}

// Plain, Bronze, Silver, Gold, Platinum, Rainbow, Legend: the tier metals ring the frame (docs/design/visual-system.md).
const FRAME_STYLES: [string, string, IconComponent, IconVariant][] = [
  ['border-hairline-strong', 'bg-panel', GemIcon, 'line'],
  ['border-tier-bronze', 'bg-panel', GemIcon, 'solid'],
  ['border-tier-silver', 'bg-panel', GemIcon, 'solid'],
  ['border-tier-gold', 'bg-accent-wash', GemIcon, 'duotone'],
  ['border-tier-platinum', 'bg-panel', SparkIcon, 'solid'],
  ['border-accent', 'bg-gradient-to-br from-accent-wash via-panel to-page', SparkIcon, 'duotone'],
  ['border-accent-strong', 'bg-accent-wash', StarIcon, 'duotone'],
]

export function badgeFrameStyle(prestige: number): BadgeFrameStyle {
  const frame = prestigeFrame(prestige)
  const [borderClass, backgroundClass, Glyph, glyphVariant] = FRAME_STYLES[frame.index]!
  return { ...frame, borderClass, backgroundClass, Glyph, glyphVariant }
}
