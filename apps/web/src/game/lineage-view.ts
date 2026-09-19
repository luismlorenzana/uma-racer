// Finite frozen lineage projection for the profile (docs/design/skills-and-inheritance.md#inheritance).

import type { ParentSnapshot, UmaSave } from '@racer/domain'
import type { LoadedContent } from '../content/runtime'

export interface LineageNodeView {
  umaId: string
  name: string
  completedTier: number
  takenAt: number
  uniqueCount: number
  whiteCount: number
  missingContent: boolean
  grandparents: LineageNodeView[]
}

function nameFor(id: string, content: LoadedContent): { name: string; missing: boolean } {
  const template = content.umas.byId.get(id)
  return { name: template?.name ?? `Missing content · ${id}`, missing: !template }
}

function node(snapshot: ParentSnapshot, content: LoadedContent): LineageNodeView {
  const display = nameFor(snapshot.umaId, content)
  return {
    umaId: snapshot.umaId,
    name: display.name,
    completedTier: snapshot.completedTier,
    takenAt: snapshot.takenAt,
    uniqueCount: snapshot.inheritedUniqueSkillId ? 1 : 0,
    whiteCount: snapshot.inheritableWhiteSkillIds.length,
    missingContent: display.missing,
    grandparents: snapshot.parents.map((parent) => {
      const grandDisplay = nameFor(parent.umaId, content)
      return {
        umaId: parent.umaId,
        name: grandDisplay.name,
        completedTier: parent.completedTier,
        takenAt: parent.takenAt,
        uniqueCount: parent.inheritedUniqueSkillId ? 1 : 0,
        whiteCount: parent.inheritableWhiteSkillIds.length,
        missingContent: grandDisplay.missing,
        grandparents: [],
      }
    }),
  }
}

export function buildLineageView(save: UmaSave, content: LoadedContent): {
  activeParents: LineageNodeView[]
  latestSnapshot: LineageNodeView | null
} {
  return {
    activeParents: save.currentParents.map((parent) => node(parent, content)),
    latestSnapshot: save.parentSnapshot ? node(save.parentSnapshot, content) : null,
  }
}
