// Keep post-training node links aligned with the three views (docs/design/ux.md).

import { constellationTemplate } from '@racer/domain'

export function constellationNodeHref(umaId: string, tier: number, nodeId: string): string {
  const node = constellationTemplate(tier).nodes.find((entry) => entry.id === nodeId)
  const suffix = node?.kind === 'parent' || node?.kind === 'grandparent' ? '/inspiration' : ''
  return `/constellation/${encodeURIComponent(umaId)}${suffix}?node=${encodeURIComponent(nodeId)}`
}
