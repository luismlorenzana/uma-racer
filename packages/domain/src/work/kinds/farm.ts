// Racer's Farm plans and aptitude EXP (07 §2–§4, D375). The package owns reserving, clocks, queues and payment.
import { payItems } from '@luismlorenzana/uma-work'
import { bestExpTenths, expFamilies, makesHere, stepBaseMinutes } from '../../farm/jobs'
import { farmExpPerItem } from '../../farm/level'
import { itemById } from '../../items/catalogue'
import { canWorkGrade, gradeOpensAtFarmLevel } from '../../items/grades'
import { recipeOf } from '../../items/recipes'
import { workSeconds } from '../../state/time'
import { tierRefusal } from '../../tiers/refusals'
import type { WorkKindRules } from '../kinds'
import { workRefusal } from '../refusals'
import { SESSION_KIND, type FarmKind } from '../types'

export function farmKind(kind: FarmKind): WorkKindRules {
  return Object.freeze({
    plan(state, outfitId, request, _now, context) {
      if (request.kind === SESSION_KIND || request.kind !== kind) return workRefusal('not-here')
      const item = itemById(request.item)
      if (item === undefined || item.kind === 'ticket' || !makesHere(kind, item, context.slot.building)) return workRefusal('not-here')
      const uma = state.umas[outfitId]
      if (!uma) return tierRefusal('unknown-uma', { uma: outfitId })
      if (!canWorkGrade(uma.farm.level, item.grade)) return workRefusal('grade', { level: gradeOpensAtFarmLevel(item.grade), grade: item.grade })
      const base = stepBaseMinutes(kind, item.grade)
      const planned = Object.freeze({
        seconds: workSeconds(base, context.speed),
        inputs: recipeOf(item.id)?.inputs ?? [],
        output: Object.freeze({ item: item.id }),
        exp: farmExpPerItem(workSeconds(base), bestExpTenths(context.env.content, outfitId, expFamilies(item))),
      })
      return Array.from({ length: request.count }, () => planned)
    },
    pay: (state, id, outputs) => payItems(state, id, outputs),
  } satisfies WorkKindRules)
}
