// Which distance preset a training screen is building (D252): its shoe and name, beside the scenario and Training Level.

import type { DistanceCategory } from '@racer/domain'
import { DISTANCE_ICONS, DistanceTypeIcon } from './CardFocusIcons'
import { Crest } from './Crest'

export function PresetBadge({ preset, className = '' }: { preset: DistanceCategory; className?: string }) {
  return (
    <Crest className={className}>
      <DistanceTypeIcon distance={preset} size={16} />
      {DISTANCE_ICONS[preset].label}<span className="sr-only"> preset</span>
    </Crest>
  )
}
