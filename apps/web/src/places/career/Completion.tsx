// A completed career (D387): the trophy, her URA Finale racing build as the final froze it (five stats, aptitudes,
// skills), the tickets the URA Finals paid, and what comes next. The career page shows it in place of the season card
// once the final is won, and the final's result shows it first.
import { CardsIcon, Panel, TrophyIcon, UiMark, useReducedMotionSetting } from '@luismlorenzana/uma-kit/ui'
import { FINALE_REWARD } from '@racer/domain/career'
import type { SkillTemplate } from '@racer/domain'
import type { RacingBuild } from '@racer/domain/save'
import { m } from 'motion/react'
import { AptitudeGrid, SkillNames, StatRow } from '../../ui/BuildFacts'
import { careersWords } from './model'

export function TicketsEarned() {
  return (
    <section className="space-y-1.5" aria-label={careersWords('tickets-earned')} data-racer="tickets-earned">
      <h3 className="text-micro">{careersWords('tickets-earned')}</h3>
      <ul className="flex flex-wrap gap-2 text-[14px] font-semibold">
        <li className="flex min-h-8 items-center gap-1.5 rounded-full bg-accent-wash px-3">
          <UiMark mark="currency/uma-ticket" />{careersWords('uma-ticket', { n: FINALE_REWARD.umaTickets })}
        </li>
        <li className="flex min-h-8 items-center gap-1.5 rounded-full bg-accent-wash px-3">
          <UiMark mark="currency/card-ticket" fallback={<CardsIcon size={16} variant="duotone" />} />{careersWords('card-tickets', { n: FINALE_REWARD.cardTickets })}
        </li>
      </ul>
    </section>
  )
}

export function Completion({ build, skills }: { build: RacingBuild | null; skills: ReadonlyMap<string, SkillTemplate> | null }) {
  const reducedMotion = useReducedMotionSetting()
  return (
    <Panel className="space-y-4 p-4" data-racer="completion">
      <div className="flex items-center gap-3">
        <m.span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-wash"
          initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 16 }}
        >
          <TrophyIcon size={32} variant="solid" className="text-tier-gold" />
        </m.span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold leading-tight">{careersWords('complete')}</h2>
          <p className="text-[13px] text-ink-soft">{careersWords('complete-line')}</p>
        </div>
      </div>
      {build !== null && (
        <section className="space-y-3" aria-label={careersWords('racing-build')} data-racer="frozen-build">
          <h3 className="text-micro">{careersWords('racing-build')}</h3>
          <StatRow stats={build.stats} />
          <AptitudeGrid aptitudes={build.aptitudes} />
          <SkillNames ids={build.skills} skills={skills} empty={careersWords('no-skills')} />
        </section>
      )}
      <TicketsEarned />
      <p className="rounded-sm bg-sunken px-3 py-2 text-[14px] font-semibold" data-racer="next-scenario">{careersWords('next-scenario')}</p>
    </Panel>
  )
}
