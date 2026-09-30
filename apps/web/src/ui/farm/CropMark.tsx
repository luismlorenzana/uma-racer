// Original code-native Farm produce mark; private or original-game crop art never enters git (T084–T085).

import type { FarmCropDefinition } from '@racer/domain'
import { TYPE_ICON_COLORS, type TypeIconKind } from '../TypeIcon'

export function CropMark({ crop, size = 48 }: { crop: FarmCropDefinition; size?: number }) {
  const color = TYPE_ICON_COLORS[crop.stat as TypeIconKind]
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={`${crop.name}, ${crop.stat} produce`} className="inline-block shrink-0">
      <circle cx="28" cy="30" r="19" fill={color.top} stroke={color.rim} strokeWidth="3" />
      <path d="M27 14c-1-7 4-11 11-10-1 7-5 10-11 10Z" fill="#238958" />
      <path d="M27 15c-5-6-10-7-15-3 4 5 9 7 15 3Z" fill="#45aa67" />
      <path d="M20 27c4-5 12-5 16 0M19 35c5 4 13 4 18 0" fill="none" stroke={color.glyph} strokeWidth="3" strokeLinecap="round" opacity=".9" />
    </svg>
  )
}
