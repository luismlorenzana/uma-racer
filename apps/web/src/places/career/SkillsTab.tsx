// Upgrade's Skills (D387): the SP she can spend and what's left of her scenario's SP cap, the skills she has bought,
// then her library (her own skills and every skill a card has hinted) with each one's cost after its hint discount
// (the full price struck beside it) and **Buy** (`buy-skill`). A skill she can't buy says why in the rule's own words:
// a gold names the white it needs.
import { Button, SkillPointsIcon, StarIcon } from '@luismlorenzana/uma-kit/ui'
import { buySkill, skillCost, skillLibrary, skillPoints, type BuildView } from '@racer/domain/build'
import type { UmaTemplate } from '@racer/domain'
import { isRefusal, type CareerRecord, type OperationEnv, type SaveState } from '@racer/domain/save'
import { amount } from '../../ui/labels'
import { SkillNames } from '../../ui/BuildFacts'
import { careersWords } from './model'
import { useCareerOp } from './useCareerOp'

export function SkillsTab({ careerId, career, state, env, view, uma }: {
  careerId: string; career: CareerRecord; state: SaveState; env: OperationEnv; view: BuildView; uma: UmaTemplate
}) {
  const op = useCareerOp()
  const skills = env.content.skills
  const points = skillPoints(career, view)
  const library = skillLibrary(career, uma, env.content.cards, state.bonds, skills).filter((entry) => !career.skills.includes(entry.skillId))
  return (
    <div className="space-y-3" data-racer="skills-tab">
      <div className="flex items-end justify-between gap-2">
        <p className="flex items-center gap-1.5 font-display text-[15px] font-semibold" aria-label={`${careersWords('sp')} ${points.available}`} data-racer="sp-available">
          <SkillPointsIcon size={24} variant="duotone" className="text-accent-strong" />
          <span aria-hidden className="numeral text-xl">{amount(points.available)}</span>
          <span aria-hidden className="text-[13px] text-ink-soft">{careersWords('sp')}</span>
        </p>
        <p className="text-[12px] text-ink-soft" data-racer="sp-cap">{careersWords('sp-left', { left: amount(points.cap - points.spent), cap: amount(points.cap) })}</p>
      </div>
      <section className="space-y-1.5" aria-label={careersWords('bought')}>
        <h3 className="text-micro">{careersWords('bought')}</h3>
        <SkillNames ids={career.skills} skills={skills} empty={careersWords('no-skills')} />
      </section>
      <section className="space-y-1.5" aria-label={careersWords('library')}>
        <h3 className="text-micro">{careersWords('library')}</h3>
        {library.length === 0 ? <p className="text-[13px] text-ink-soft">{careersWords('no-library')}</p> : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-panel">
            {library.map((entry) => {
              const skill = skills.get(entry.skillId)
              if (skill === undefined) return null
              const cost = skillCost(skill, entry.hintLevel)
              const check = buySkill(career, view, uma, skills, entry.skillId)
              const why = isRefusal(check) ? check.reason : null
              const gold = skill.kind === 'gold'
              return (
                <li key={entry.skillId} className="space-y-1 px-3 py-2" data-skill={entry.skillId} data-cost={cost ?? undefined}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[14px] font-semibold">
                        {gold && <StarIcon size={16} variant="solid" className="shrink-0 text-tier-gold" title="Gold" />}
                        <span className="truncate">{skill.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[12px] text-ink-soft">
                        {entry.hintLevel > 0 && <span className="rounded-full bg-accent-wash px-1.5 font-semibold text-ink">{careersWords('hint-level', { n: entry.hintLevel })}</span>}
                        {cost !== null && (
                          <span className="numeral">
                            {cost} SP{skill.costSp !== null && skill.costSp !== cost && <s className="ml-1 text-ink-faint">{skill.costSp}</s>}
                          </span>
                        )}
                      </span>
                    </span>
                    <Button size="sm" disabled={why !== null || op.busy} onClick={() => void op.go('buy-skill', { careerId, skillId: entry.skillId })}
                      aria-label={`${careersWords('buy')} ${skill.name}${cost === null ? '' : `, ${cost} SP`}`}>
                      {careersWords('buy')}
                    </Button>
                  </div>
                  {why !== null && <p className="text-[12px] text-ink-soft" data-racer="skill-why">{why}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {op.error !== null && <p role="alert" className="text-[13px] text-danger">{op.error}</p>}
    </div>
  )
}
