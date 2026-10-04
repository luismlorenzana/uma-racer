import { STATS, type CardSave, type Stats, type UmaSave } from '@racer/domain'
import { useMemo, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import type { LoadedContent } from '../content/runtime'
import { useGame } from '../game/store'
import { useChosenTier } from '../game/scenario-choice'
import { joinUma, type UmaViewModel } from '../game/view'
import { PresetBadge } from '../ui/PresetBadge'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { ScreenState } from '../ui/ScreenState'
import { SegmentedControl } from '../ui/SegmentedControl'
import { ChevronLeftIcon } from '../ui/icons'
import { TypeIcon } from '../ui/TypeIcon'

export interface TrainingContext {
  content: LoadedContent
  save: UmaSave
  uma: UmaViewModel
  cards: Readonly<Record<string, CardSave>>
  umas: Readonly<Record<string, UmaSave>>
  tickets: number
}

/** The two tabs of the Training scene read the same joined Uma the scene header does. */
export const useTraining = (): TrainingContext => useOutletContext<TrainingContext>()

type TrainingTab = 'constellation' | 'cards'

/**
 * The Training scene: one header, one live stat strip, and the two things that decide those stats — the
 * constellation and the card set — as tabs (M016). Full screen, like a race, so the tab bar never competes.
 */
export function TrainingScene() {
  const { umaId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const umas = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const tickets = useGame((state) => state.profile?.tickets ?? 0)
  /** Stats as they were when the scene opened, so every delta reads against one stable reference across tabs. */
  const baseline = useRef<Stats | null>(null)

  const save = umas[umaId]
  // The scenario chosen for her on her profile or Race Select (D190).
  const tier = useChosenTier(save) ?? undefined
  const joined = useMemo(
    () => (contentState.status === 'ready' && save ? joinUma(save, contentState.content, cards, tier) : null),
    [cards, contentState, save, tier],
  )

  if (contentState.status !== 'ready' || status !== 'ready') {
    return <ScreenState title="Opening training…" detail="Loading private content and your local save." />
  }
  if (!save || !joined || joined.status !== 'ready') {
    return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />
  }

  const uma = joined.value
  const { derived, run, caps } = uma
  if (baseline.current === null) baseline.current = derived.stats
  const base = `/constellation/${encodeURIComponent(save.templateId)}`
  const tab: TrainingTab = location.pathname.endsWith('/cards') ? 'cards' : 'constellation'
  const separateView = location.pathname.endsWith('/inspiration') ? 'Inspiration'
    : location.pathname.endsWith('/extra-stats') ? 'Extra stats' : null
  const context: TrainingContext = { content: contentState.content, save, uma, cards, umas, tickets }

  return (
    <div className="flex h-dvh flex-col bg-page pt-safe">
      <header className="flex items-center justify-between gap-2 px-4 py-2">
        <Link to={`/stable/${encodeURIComponent(save.templateId)}`} className="flex min-h-11 min-w-0 items-center gap-1 text-sm font-semibold text-ink-soft">
          <ChevronLeftIcon size={20} />
          <span className="truncate">{uma.template.name}</span>
        </Link>
        <div className="flex shrink-0 gap-1">
          {/* Everything here builds her selected distance preset (D252). */}
          <PresetBadge preset={run.preset} />
          <Crest>{uma.scenario?.name ?? `Tier ${run.tier}`}</Crest>
          <Crest tone="accent">TL {run.trainingLevel}</Crest>
        </div>
      </header>

      <div className="flex gap-1.5 px-3 pb-2">
        {STATS.map((stat) => {
          const value = derived.stats[stat]
          const delta = value - (baseline.current?.[stat] ?? value)
          return (
            <div key={stat} className="min-w-0 flex-1 rounded-lg bg-panel px-1.5 py-1">
              <div className="flex items-baseline justify-between">
                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase text-ink-faint"><TypeIcon type={stat} size={12} />{stat.slice(0, 3)}</span>
                {delta !== 0 && (
                  <span className={`text-[9px] font-bold ${delta > 0 ? 'text-go' : 'text-danger'}`}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </div>
              <Numeral className="block text-[14px] leading-tight">{value}</Numeral>
              <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.min(100, (value / caps[stat]) * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
        <div className="min-w-0 flex-1 rounded-lg bg-sunken px-1.5 py-1">
          <span className="text-[9px] font-semibold uppercase text-ink-faint">SP</span>
          <Numeral className="block text-[14px] leading-tight">{derived.skillPoints}</Numeral>
          <span className="text-[8px] text-ink-faint">of {uma.spCap}</span>
        </div>
      </div>

      <div className="px-3 pb-2">
        {separateView ? <h1 className="font-display text-lg font-bold">{separateView}</h1> : <SegmentedControl
          label="Training"
          value={tab}
          onChange={(next) => navigate(next === 'cards' ? `${base}/cards` : base, { replace: true })}
          options={[{ value: 'constellation', label: 'Constellation' }, { value: 'cards', label: 'Card set' }] as const}
        />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet context={context} />
      </div>
    </div>
  )
}
