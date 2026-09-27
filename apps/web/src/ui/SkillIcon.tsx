import type { SkillTemplate } from '@racer/domain'
import { useContent } from '../content/ContentProvider'
import { getContentAsset } from '../content/runtime'
import { AtlasSprite } from './AtlasSprite'
import { StarIcon } from './icons'

const FALLBACK_TONE: Record<string, string> = {
  gold: 'bg-accent text-ink',
  unique: 'bg-ink text-ink-on-dark',
  'unique-upgraded': 'bg-ink text-ink-on-dark',
  'inherited-unique': 'bg-gradient-to-br from-stat-guts to-stat-speed text-white',
}

/**
 * A skill's icon as the original draws it (D182), from the private skill atlas by the skill's `iconId`. Without one a
 * star on the kind's colour stands in, so a list never waits on an atlas.
 */
export function SkillIcon({
  skill,
  size = 24,
  className = '',
}: {
  skill: Pick<SkillTemplate, 'iconId' | 'kind'> | null | undefined
  size?: number
  className?: string
}) {
  const contentState = useContent()
  const asset = contentState.status === 'ready' && skill?.iconId
    ? getContentAsset(contentState.content, 'skill-icons', String(skill.iconId))
    : null
  return (
    <AtlasSprite
      asset={asset}
      decorative
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
      fallback={(
        <span
          className={`flex h-full w-full items-center justify-center rounded-[22%] ${FALLBACK_TONE[skill?.kind ?? ''] ?? 'bg-sunken text-ink-soft'}`}
          style={{ width: size, height: size }}
        >
          <StarIcon size={16} variant="solid" />
        </span>
      )}
    />
  )
}
