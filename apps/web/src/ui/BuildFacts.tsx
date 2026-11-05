// An Uma's build at a glance (docs/game/02-unlocks.md §2, D386): her aptitudes as icon and grade, her growth rates and
// a build's five stats as stat icons with their numbers, and skills by name. The Stable's unlock sheet and profile draw
// them, and the career screens can too. Icons carry each label; theme tokens only.
import { DirtIcon, StarIcon, TurfIcon } from '@luismlorenzana/uma-kit/ui'
import type { Aptitudes, Grade, SkillTemplate, Stats } from '@racer/domain'
import type { ReactNode } from 'react'
import { DistanceTypeIcon, RunningStyleIcon } from './CardFocusIcons'
import { DISTANCE_LABEL, DISTANCES, STAT_KEYS, STAT_LABEL, STYLE_LABEL, STYLES, SURFACE_LABEL, SURFACE_KEYS } from './labels'
import { TypeIcon } from './TypeIcon'

/** A grade's ink: S and A stand out, B and C read plainly, D to G (or none) fade. */
export function gradeTone(grade: Grade | undefined): string {
  if (grade === 'S' || grade === 'A') return 'text-accent-strong'
  if (grade === 'B' || grade === 'C') return 'text-ink'
  return 'text-ink-faint'
}

/** One aptitude: its icon and grade; a grade the content lacks reads as a dash. */
function Cell({ icon, label, grade }: { icon: ReactNode; label: string; grade: Grade | undefined }) {
  const shown = grade ?? '–'
  return (
    <li className="flex min-h-8 items-center gap-1.5" aria-label={`${label} ${shown}`}>
      {icon}
      <span aria-hidden className={`font-display text-[17px] font-bold ${gradeTone(grade)}`}>{shown}</span>
    </li>
  )
}

/** Her aptitudes: surface, distance and running style, each an icon with its grade. */
export function AptitudeGrid({ aptitudes }: { aptitudes: Partial<{ [K in keyof Aptitudes]: Partial<Aptitudes[K]> }> }) {
  const row = 'grid grid-cols-4 gap-x-2'
  return (
    <div className="space-y-1.5" data-racer="aptitudes">
      <ul className={row} aria-label="Surface">
        {SURFACE_KEYS.map((surface) => (
          <Cell key={surface} label={SURFACE_LABEL[surface]} grade={aptitudes.surface?.[surface]}
            icon={surface === 'turf' ? <TurfIcon size={20} className="text-turf" /> : <DirtIcon size={20} className="text-dirt" />} />
        ))}
      </ul>
      <ul className={row} aria-label="Distance">
        {DISTANCES.map((distance) => (
          <Cell key={distance} label={DISTANCE_LABEL[distance]} grade={aptitudes.distance?.[distance]} icon={<DistanceTypeIcon distance={distance} size={20} />} />
        ))}
      </ul>
      <ul className={row} aria-label="Running style">
        {STYLES.map((style) => (
          <Cell key={style} label={STYLE_LABEL[style]} grade={aptitudes.strategy?.[style]} icon={<RunningStyleIcon style={style} size={20} />} />
        ))}
      </ul>
    </div>
  )
}

/** Her growth rates (fractions): "+10%" under each stat's icon; a stat without one reads "0%". */
export function GrowthRow({ growth }: { growth: Stats }) {
  return (
    <ul className="grid grid-cols-5 gap-1" aria-label="Growth rates" data-racer="growth">
      {STAT_KEYS.map((stat) => {
        const pct = Math.round((growth[stat] ?? 0) * 100)
        return (
          <li key={stat} className="flex flex-col items-center gap-0.5" aria-label={`${STAT_LABEL[stat]} +${pct}%`}>
            <TypeIcon type={stat} size={24} />
            <span aria-hidden className={`numeral text-[13px] font-semibold ${pct > 0 ? 'text-ink' : 'text-ink-faint'}`}>{pct > 0 ? `+${pct}%` : '0%'}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** A build's five stats, each under its icon. */
export function StatRow({ stats }: { stats: Stats }) {
  return (
    <ul className="grid grid-cols-5 gap-1" aria-label="Stats" data-racer="stats">
      {STAT_KEYS.map((stat) => (
        <li key={stat} className="flex flex-col items-center gap-0.5" aria-label={`${STAT_LABEL[stat]} ${stats[stat]}`}>
          <TypeIcon type={stat} size={24} />
          <span aria-hidden className="numeral text-[15px] font-bold">{stats[stat]}</span>
        </li>
      ))}
    </ul>
  )
}

/** Skills by name, golds starred; an id the content lacks shows as the id. */
export function SkillNames({ ids, skills, empty }: { ids: readonly string[]; skills: ReadonlyMap<string, SkillTemplate> | null; empty: string }) {
  if (ids.length === 0) return <p className="text-[13px] text-ink-soft">{empty}</p>
  return (
    <ul className="flex flex-wrap gap-1.5" data-racer="skills">
      {ids.map((id) => {
        const skill = skills?.get(id)
        const gold = skill?.kind === 'gold' || skill?.kind === 'unique' || skill?.kind === 'unique-upgraded'
        return (
          <li key={id} className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[13px] ${gold ? 'border-tier-gold bg-accent-wash text-ink' : 'border-hairline bg-panel text-ink'}`}>
            {gold && <StarIcon size={16} variant="solid" className="text-tier-gold" title="Gold" />}
            {skill?.name ?? id}
          </li>
        )
      })}
    </ul>
  )
}
