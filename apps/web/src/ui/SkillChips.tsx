import type { Aptitudes, SkillEffectTag, SkillPhase, SkillPlace, SkillTags } from '@racer/domain'

const STRATEGY: Record<string, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' }
const DISTANCE: Record<string, string> = { sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long' }
const SURFACE: Record<string, string> = { turf: 'Turf', dirt: 'Dirt' }
// The race HUD's names for the four phases, so a skill reads the way the race does.
const PHASE: Record<SkillPhase, string> = { early: 'Opening', mid: 'Middle leg', late: 'Final leg', spurt: 'Last spurt' }
const PLACE: Record<SkillPlace, string> = {
  start: 'Start',
  corner: 'Corner',
  straight: 'Straight',
  'final-corner': 'Final corner',
  'final-straight': 'Final straight',
  uphill: 'Uphill',
  downhill: 'Downhill',
}
const EFFECT: Record<SkillEffectTag, string> = {
  speed: 'Speed',
  acceleration: 'Acceleration',
  recovery: 'Recovery',
  stats: 'Stats',
  start: 'Start',
  lane: 'Lane',
  vision: 'Vision',
  debuff: 'Debuff',
}

const fits = (grade: string | undefined) => grade === 'S' || grade === 'A'

/**
 * Who a skill is for and when it fires: running style, distance and surface first, tinted where this Uma's aptitude
 * is A or better, then the moment and what it does (docs/design/skills-and-inheritance.md#skill-tags).
 */
export function SkillChips({ tags, aptitudes }: { tags: SkillTags; aptitudes?: Aptitudes }) {
  const chip = (key: string, label: string, match: boolean | null) => (
    <span
      key={key}
      className={`rounded-xs px-1.5 py-px text-[10px] leading-4 font-semibold ${
        match ? 'bg-accent-wash text-accent-strong' : match === false ? 'bg-sunken text-ink-faint' : 'bg-sunken text-ink-soft'
      }`}
    >
      {label}
    </span>
  )
  const anyone = tags.strategies.length === 0 && tags.distances.length === 0
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {anyone && chip('any', 'Any style', null)}
      {tags.strategies.map((strategy) => chip(`s-${strategy}`, STRATEGY[strategy]!, aptitudes ? fits(aptitudes.strategy[strategy]) : null))}
      {tags.distances.map((distance) => chip(`d-${distance}`, DISTANCE[distance]!, aptitudes ? fits(aptitudes.distance[distance]) : null))}
      {tags.surfaces.map((surface) => chip(`g-${surface}`, SURFACE[surface]!, aptitudes ? fits(aptitudes.surface[surface]) : null))}
      {tags.phases.map((phase) => chip(`p-${phase}`, PHASE[phase], null))}
      {tags.places.map((place) => chip(`l-${place}`, PLACE[place], null))}
      {tags.effects.map((effect) => chip(`e-${effect}`, EFFECT[effect], null))}
    </span>
  )
}
