import {
  SCENARIOS,
  awakeningSkillsOpen,
  compileRaceSkill,
  raceSkillCompatibleWithCourse,
  raceSkillSupported,
  skillAimsAtOthers,
  skillChainBelow,
  skillTags,
  summarizeSkillLoadout,
  type Aptitudes,
  type RaceTemplate,
  type SkillTags,
  type SkillTemplate,
  type SkillUnlock,
} from '@racer/domain'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import type { LoadedContent } from '../content/runtime'
import { setUmaLoadout } from '../game/actions'
import { safeReturnPath } from '../game/bond-links'
import { useChosenTier } from '../game/scenario-choice'
import { joinUma } from '../game/view'
import { useGame } from '../game/store'
import { Chip } from '../ui/Chip'
import { CheckIcon, ChevronLeftIcon, PlusIcon } from '../ui/icons'
import { SaveErrorState } from '../ui/SaveErrorState'
import { ScreenState } from '../ui/ScreenState'
import { Collapsible } from '../ui/Section'
import { SkillChips } from '../ui/SkillChips'
import { SkillKindBadge } from '../ui/SkillKindBadge'
import { SkillIcon } from '../ui/SkillIcon'

// An Uma's skills on a page of their own (D175): the whole library with room to scroll, grouped by kind, filterable,
// equipped with a tap, and the SP budget always in sight. The profile shows only what she carries.

type Filter = 'all' | 'equipped' | 'fits' | 'inherited' | 'gold' | 'white'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'equipped', label: 'Equipped' },
  { value: 'fits', label: 'Fits her' },
  { value: 'inherited', label: 'Inherited uniques' },
  { value: 'gold', label: 'Gold' },
  { value: 'white', label: 'White' },
]

const good = (grade: string | undefined) => grade === 'S' || grade === 'A'

/** A skill fits her when every style, distance and surface it asks for includes one she runs at A or better. */
export function skillFitsAptitudes(tags: SkillTags, aptitudes: Aptitudes): boolean {
  return (tags.strategies.length === 0 || tags.strategies.some((entry) => good(aptitudes.strategy[entry])))
    && (tags.distances.length === 0 || tags.distances.some((entry) => good(aptitudes.distance[entry])))
    && (tags.surfaces.length === 0 || tags.surfaces.some((entry) => good(aptitudes.surface[entry])))
}

export interface SkillRowModel {
  unlock: SkillUnlock
  skill: SkillTemplate
  own: boolean
  equipped: boolean
  supported: boolean
  fits: boolean
  /** On the race being prepared, whether it can trigger at all; null without a race. */
  onCourse: boolean | null
  source: string
  /** What equipping it costs now, and the lower skills of its chain that come with it (D188). */
  price?: { cost: number; with: string[] }
  /** Learned through an equipped upgrade, so it is part of that skill rather than equipped on its own. */
  includedIn?: string | null
  /** Equipped, but an equipped upgrade of it races instead. */
  upgradedBy?: string | null
}

/** Where a skill in her library came from, in words. */
export function skillSource(content: LoadedContent, unlock: SkillUnlock, lineageRole: (templateId: string) => string | null): string {
  switch (unlock.origin) {
    case 'own-unique': return 'Her unique'
    case 'awakening': {
      // Her own kit (D186), told apart by her template: a skill on two lists reads as its awakening one.
      const template = unlock.sourceId ? content.umas.byId.get(unlock.sourceId) : undefined
      if (template?.awakeningSkillIds.includes(unlock.skillId)) return 'Her awakening skill'
      if (template?.innateSkillIds?.includes(unlock.skillId)) return 'Hers from the start'
      if (template?.eventSkillIds?.includes(unlock.skillId)) return 'From her story'
      return 'Her own skill'
    }
    case 'card': {
      const card = unlock.sourceId ? content.cards.byId.get(unlock.sourceId) : undefined
      return card ? `Card · ${card.charName}` : 'Card'
    }
    case 'inherited': {
      const parent = unlock.sourceId ? content.umas.byId.get(unlock.sourceId) : undefined
      const role = unlock.sourceId ? lineageRole(unlock.sourceId) : null
      return parent ? `Lineage · ${parent.name}${role ? ` (${role})` : ''}` : 'Lineage'
    }
    default: return ''
  }
}

function SkillRow({ row, aptitudes, busy, onToggle }: { row: SkillRowModel; aptitudes: Aptitudes; busy: boolean; onToggle: () => void }) {
  const { skill, own, equipped, supported } = row
  const price = row.price
    ? `${row.price.cost} SP${row.price.with.length > 0 ? ` · with ${row.price.with.join(', ')}` : ''}`
    : `${skill.costSp ?? '—'} SP`
  const status = own
    ? supported ? 'Always equipped' : 'Waits for later race mechanics'
    : !supported ? skillAimsAtOthers(skill) ? 'Only affects rivals · not in this game' : 'Needs later race mechanics'
      : row.includedIn ? `Included in ${row.includedIn}` : price
  return (
    <button
      type="button"
      aria-pressed={equipped}
      disabled={own || (!supported && !equipped) || Boolean(row.includedIn) || busy}
      onClick={onToggle}
      className={`flex min-h-14 items-start gap-2 rounded-md border px-2.5 py-2 text-left disabled:opacity-60 ${equipped ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${equipped ? 'bg-accent text-white' : 'bg-sunken text-ink-soft'}`}>
        {equipped ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <SkillIcon skill={skill} size={24} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{skill.name}</span>
          <SkillKindBadge kind={skill.kind} />
        </span>
        <SkillChips tags={skillTags(skill)} aptitudes={aptitudes} />
        {skill.description && <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-ink-soft">{skill.description}</span>}
        <span className="text-micro mt-1 flex flex-wrap gap-x-2">
          <span className="font-semibold text-ink">{status}</span>
          <span>{row.source}</span>
          {row.upgradedBy && <span className="text-accent-strong">{row.upgradedBy} races instead</span>}
          {row.onCourse === false && supported && <span className="text-danger">can’t trigger in this race</span>}
        </span>
      </span>
    </button>
  )
}

export function UmaSkillsScreen() {
  const { umaId = '' } = useParams()
  const [params] = useSearchParams()
  const returnTo = safeReturnPath(params.get('return'), `/stable/${encodeURIComponent(umaId)}`)
  const raceId = params.get('race')
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const error = useGame((state) => state.error)
  const save = useGame((state) => state.umas[umaId])
  const cards = useGame((state) => state.cards)
  const pushToast = useGame((state) => state.pushToast)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const content = contentState.status === 'ready' ? contentState.content : null
  // The scenario chosen for her (D190): each trained unit keeps its own library and loadout.
  const tier = useChosenTier(save) ?? undefined
  const joined = useMemo(() => content && save ? joinUma(save, content, cards, tier) : null, [cards, content, save, tier])
  const race: RaceTemplate | undefined = raceId && content ? content.races.byId.get(raceId) : undefined

  const rows = useMemo((): SkillRowModel[] => {
    if (!content || joined?.status !== 'ready') return []
    const uma = joined.value
    const assignments = uma.derived.scenario.assignments
    const lineageRole = (templateId: string) => {
      const nodeId = Object.entries(assignments).find(([, assignment]) => assignment.kind === 'lineage' && assignment.templateId === templateId)?.[0]
      return nodeId ? nodeId.includes('-gp') ? 'grandparent' : 'parent' : null
    }
    return uma.derived.library.flatMap((unlock) => {
      const skill = content.skills.byId.get(unlock.skillId)
      if (!skill) return []
      const compiled = compileRaceSkill(skill)
      const supported = raceSkillSupported(compiled)
      const own = unlock.origin === 'own-unique'
      return [{
        unlock,
        skill,
        own,
        equipped: own || uma.derived.loadoutSkillIds.includes(skill.id),
        supported,
        fits: skillFitsAptitudes(skillTags(skill), uma.derived.aptitudes),
        onCourse: race ? raceSkillCompatibleWithCourse(compiled, race) : null,
        source: skillSource(content, unlock, lineageRole),
      }]
    })
  }, [content, joined, race])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to manage skills" detail="Skills are part of your private save." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (status === 'error') return <SaveErrorState detail={error} />
  if (!content || status !== 'ready') return <ScreenState title="Opening skills…" detail="Loading private content and save data." />
  if (!save || joined?.status !== 'ready') return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />

  const uma = joined.value
  const loadout = summarizeSkillLoadout(uma.derived, uma.template, content.skills.byId)
  // Her awakening skills still closed in this scenario (D186): shown, so nothing of hers is hidden, with where they open.
  const inLibrary = new Set(uma.derived.library.map((unlock) => unlock.skillId))
  const lockedOwn = uma.template.awakeningSkillIds.slice(awakeningSkillsOpen(uma.derived.tier))
    .filter((id) => !inLibrary.has(id))
    .flatMap((id) => content.skills.byId.get(id) ?? [])
  const opensIn = SCENARIOS[uma.derived.tier]?.name
  const needle = search.trim().toLocaleLowerCase()
  // Upper skills (D188): a gold carries its white (a double-circle white its single-circle one); each is paid once and
  // only the top of a chain races.
  const learned = new Set([...uma.derived.loadoutSkillIds, ...loadout.learnedBy.keys()])
  const entries = new Map(loadout.entries.map((entry) => [entry.skill.id, entry]))
  const priced = rows.map((row): SkillRowModel => {
    if (row.own) return row
    const entry = entries.get(row.skill.id)
    const unpaid = entry ? entry.includes : skillChainBelow(row.skill, content.skills.byId).filter((lower) => !learned.has(lower.id))
    const cost = entry ? entry.cost : (row.skill.costSp ?? 0) + unpaid.reduce((sum, lower) => sum + (lower.costSp ?? 0), 0)
    const upgrade = loadout.entries.find((other) => other.skill.id !== row.skill.id && other.belowIds.includes(row.skill.id))
    return {
      ...row,
      price: { cost, with: unpaid.map((lower) => lower.name) },
      includedIn: !row.equipped ? loadout.learnedBy.get(row.skill.id)?.name ?? null : null,
      upgradedBy: row.equipped ? upgrade?.skill.name ?? null : null,
    }
  })
  const shown = priced.filter((row) => {
    if (needle && !row.skill.name.toLocaleLowerCase().includes(needle) && !row.skill.description.toLocaleLowerCase().includes(needle)) return false
    switch (filter) {
      case 'equipped': return row.equipped
      case 'fits': return row.fits
      case 'inherited': return row.skill.kind === 'inherited-unique'
      case 'gold': return row.skill.kind === 'gold'
      case 'white': return row.skill.kind === 'white'
      default: return true
    }
  })
  // Equipped first, then what fits her, then the rest; the library's own order within each.
  const order = (row: SkillRowModel) => (row.equipped ? 0 : 2) + (row.fits ? 0 : 1)
  const sorted = (list: SkillRowModel[]) => list.map((row, index) => ({ row, index })).sort((a, b) => order(a.row) - order(b.row) || a.index - b.index).map(({ row }) => row)
  const usable = shown.filter((row) => row.supported || row.own)
  const unusable = shown.filter((row) => !row.supported && !row.own)
  const groups: { title: string; hint?: string; rows: SkillRowModel[] }[] = [
    { title: 'Her unique', rows: usable.filter((row) => row.own) },
    { title: 'Inherited uniques', hint: 'from her lineage', rows: sorted(usable.filter((row) => !row.own && row.skill.kind === 'inherited-unique')) },
    { title: 'Gold skills', rows: sorted(usable.filter((row) => row.skill.kind === 'gold')) },
    { title: 'White skills', rows: sorted(usable.filter((row) => !row.own && row.skill.kind !== 'gold' && row.skill.kind !== 'inherited-unique')) },
  ]

  const toggle = async (skillId: string) => {
    if (saving) return
    const current = uma.derived.loadoutSkillIds
    const skill = content.skills.byId.get(skillId)
    // Equipping an upgrade takes the place of any lower skill of its chain already equipped: it includes them (D188).
    const below = new Set(skill ? skillChainBelow(skill, content.skills.byId).map((lower) => lower.id) : [])
    const at = current.findIndex((id) => below.has(id))
    const kept = current.filter((id) => !below.has(id))
    const place = at < 0 ? kept.length : current.slice(0, at).filter((id) => !below.has(id)).length
    const next = current.includes(skillId)
      ? current.filter((id) => id !== skillId)
      : [...kept.slice(0, place), skillId, ...kept.slice(place)]
    setSaving(skillId)
    try {
      await setUmaLoadout(save.templateId, next, tier)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not update skill loadout')
    } finally {
      setSaving(null)
    }
  }

  const used = Math.min(1, loadout.cap > 0 ? loadout.cost / loadout.cap : 0)
  const equippedCount = uma.derived.loadoutSkillIds.length

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Link to={returnTo} className="flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-ink-soft">
        <ChevronLeftIcon size={20} />{race ? 'Race' : uma.template.name}
      </Link>

      {/* The budget stays in sight while the list scrolls. */}
      <div className="sticky top-0 z-10 -mx-4 bg-page/90 px-4 pt-1 pb-2 backdrop-blur">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight">Skills</h1>
            <p className="truncate text-[12px] text-ink-soft">{uma.template.name}{race ? ` · for ${race.name}, ${race.distance} m ${race.surface}` : ''}</p>
          </div>
          <div className="text-right">
            <p className={`font-display text-[17px] font-bold tabular-nums ${loadout.cost > loadout.cap ? 'text-danger' : ''}`}>{loadout.cost} / {loadout.cap} SP</p>
            <p className="text-micro">{equippedCount} equipped</p>
          </div>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className={`h-full origin-left rounded-full transition-transform duration-300 ${loadout.cost > loadout.cap ? 'bg-danger' : 'bg-accent'}`} style={{ transform: `scaleX(${used})` }} />
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search skills"
          aria-label="Search skills"
          className="mt-2 min-h-11 w-full rounded-sm border border-hairline bg-panel px-3 text-[15px]"
        />
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Show">
          {FILTERS.map((entry) => (
            <Chip key={entry.value} selected={filter === entry.value} onClick={() => setFilter(entry.value)}>{entry.label}</Chip>
          ))}
        </div>
      </div>

      {!loadout.valid && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
          {loadout.cost > loadout.cap
            ? `Over budget: ${loadout.cost} SP equipped, ${loadout.cap} SP earned. Skills past the budget sit out races until a Friend or Group card pays for them, or you unequip some.`
            : loadout.errors[0]}
        </p>
      )}

      {groups.filter((group) => group.rows.length > 0).map((group) => (
        <section key={group.title} className="grid gap-1.5">
          <h2 className="text-micro mt-1 flex items-baseline justify-between">
            <span>{group.title}{group.hint ? ` · ${group.hint}` : ''}</span>
            <span>{group.rows.filter((row) => row.equipped).length} / {group.rows.length}</span>
          </h2>
          {group.rows.map((row) => (
            <SkillRow key={row.skill.id} row={row} aptitudes={uma.derived.aptitudes} busy={saving !== null} onToggle={() => void toggle(row.skill.id)} />
          ))}
        </section>
      ))}

      {shown.length === 0 && (
        <p className="rounded-md border border-hairline bg-panel p-4 text-center text-[13px] text-ink-soft">
          {rows.length === 0 ? 'Slot cards onto constellation nodes, and fill her lineage, to earn skills.' : 'No skills match.'}
        </p>
      )}

      {lockedOwn.length > 0 && filter === 'all' && !needle && (
        <section className="grid gap-1.5">
          <h2 className="text-micro mt-1">Her next awakening pair{opensIn ? ` · opens in ${opensIn}` : ''}</h2>
          {lockedOwn.map((skill) => (
            <div key={skill.id} className="flex min-h-12 items-center gap-2 rounded-md border border-dashed border-hairline px-2.5 py-2 opacity-70">
              <SkillIcon skill={skill} size={24} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{skill.name}</span>
              <SkillKindBadge kind={skill.kind} />
            </div>
          ))}
        </section>
      )}

      {unusable.length > 0 && (
        <Collapsible label="Not usable yet" count={unusable.length}>
          <div className="grid gap-1.5">
            {unusable.map((row) => (
              <SkillRow key={row.skill.id} row={row} aptitudes={uma.derived.aptitudes} busy={saving !== null} onToggle={() => void toggle(row.skill.id)} />
            ))}
          </div>
        </Collapsible>
      )}

      {uma.derived.lineage.length === 0 && (
        <p className="rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-soft">
          Her lineage opens at Training Level 9. Each parent and grandparent adds their baseline skills and their unique, in
          its inherited form.
        </p>
      )}
    </div>
  )
}
