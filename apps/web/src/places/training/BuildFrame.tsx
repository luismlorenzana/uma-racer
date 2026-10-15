// Every build view's frame (docs/game/05-training-hub.md §8; docs/game/03-uma-progression.md §6, §8;
// docs/game/11-hub-and-places.md §6; T139): the place header with Back to where it was opened from, then her header:
// her bust and name, "T1 · URA Finale", the preset switch (`?preset=`, view-only, opening on her selected preset), that
// preset's five stats and SP (`deriveUmaPreset`), and the Collect chip ("2 unlocks finished", `collect`). An id the
// Stable doesn't hold says `unknown-uma`'s words with a way to the Stable.
import type { DistanceCategory } from '@racer/domain'
import type { Place } from '@racer/domain/hub'
import { TIER_REFUSALS } from '@racer/domain/tiers'
import type { UmaState } from '@racer/domain/state'
import type { DerivedBuild } from '@racer/domain/training'
import type { WorkState } from '@racer/domain/work'
import { useMemo, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useGame } from '../../app/game'
import { UmaSquare } from '../../ui/ArtSquare'
import { amount, DISTANCE_LABEL, DISTANCES, STAT_KEYS, STAT_LABEL } from '../../ui/labels'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { Tabs } from '../../ui/Tabs'
import { TapNoteLine } from '../../ui/work/TapNote'
import { useTap, useWordsContext } from '../../ui/work/useTap'
import { useWorkView } from '../../ui/work/view'
import type { WordsContext } from '../../ui/work/words'
import { buildHeader, viewPreset } from './build'
import type { Content } from './common'
import { trainingWords } from './words'

export interface BuildContext {
  readonly uma: UmaState
  readonly preset: DistanceCategory
  readonly derived: DerivedBuild
  readonly settled: WorkState
  readonly now: number
  readonly context: WordsContext
  readonly content: Content
  /** This view's path with its query, for a link's `back`. */
  readonly here: string
}

export function BuildFrame({ place, umaId, title, lines = [], fullScreen = false, children }: {
  place: Place
  umaId: string
  /** "{uma} · constellation". */
  title: (name: string) => string
  lines?: readonly ReactNode[]
  /** A full-screen view (11 §6): the frame fills the screen with its own safe areas. */
  fullScreen?: boolean
  children: (build: BuildContext) => ReactNode
}) {
  const view = useWorkView()
  const context = useWordsContext()
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const tap = useTap()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const uma = view?.settled.umas[umaId] ?? null
  const preset = uma === null ? null : viewPreset(params.get('preset'), uma)
  const header = useMemo(
    () => (view === null || content === null || uma === null || preset === null ? null : buildHeader(view.settled, uma, preset, view.now, content)),
    [view, content, uma, preset],
  )
  const name = context.umaName(umaId) || umaId
  const frame = fullScreen ? 'pt-safe pb-safe flex h-full flex-col bg-page' : 'flex min-h-full flex-col'

  if (view === null || content === null) return <PlaceHeader place={place} rest={umaId} title={title(name)} />
  if (uma === null || header === null || preset === null) {
    return (
      <div className={frame} data-g2="build-unknown">
        <PlaceHeader place={place} rest={umaId} title={place.name} />
        <div className="m-4 rounded-md border border-hairline bg-panel p-4 text-center">
          <p>{TIER_REFUSALS['unknown-uma']}</p>
          <Link to="/town/stable" replace className="font-display mt-3 inline-flex min-h-12 items-center rounded-sm bg-accent px-5 font-semibold text-ink shadow-1">
            {trainingWords('unknown-back')}
          </Link>
        </div>
      </div>
    )
  }
  const setPreset = (next: DistanceCategory) => {
    const search = new URLSearchParams(params)
    search.set('preset', next)
    setParams(search, { replace: true, state: location.state })
  }
  const here = `${location.pathname}${location.search}`
  return (
    <div className={frame} data-g2="build-view" data-facility={place.id} data-uma={umaId}>
      <PlaceHeader place={place} rest={umaId} title={title(name)} lines={lines} />
      <section aria-label={name} className="space-y-2 border-b border-hairline px-4 py-3" data-g2="build-header">
        <div className="flex items-center gap-3">
          <span className="w-12 shrink-0"><UmaSquare outfitId={umaId} name={name} tight /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{name}</span>
            <span className="block text-[12px] text-ink-soft">{header.tierLine}</span>
          </span>
          {header.collect > 0 && (
            <button
              type="button"
              data-action="collect-chip"
              disabled={tap.pending !== null}
              onClick={() => void tap.run('collect', { outfitId: umaId }, `collect:${umaId}`)}
              className="font-display min-h-11 shrink-0 rounded-full bg-accent px-3 text-[13px] font-semibold text-ink shadow-1 disabled:opacity-45"
            >
              {header.collect === 1 ? trainingWords('collect-chip-one') : trainingWords('collect-chip', { n: header.collect })}
            </button>
          )}
        </div>
        <Tabs label={trainingWords('preset-title')} value={preset} onChange={setPreset} options={DISTANCES.map((value) => ({ value, label: DISTANCE_LABEL[value] }))} />
        <dl className="grid grid-cols-6 gap-1 text-center" data-g2="build-stats">
          {STAT_KEYS.map((stat) => (
            <div key={stat}>
              <dt className="text-[11px] text-ink-soft">{STAT_LABEL[stat]}</dt>
              <dd className="font-display text-[15px] font-semibold tabular-nums">{header.derived.stats[stat]}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[11px] text-ink-soft">SP</dt>
            <dd className="font-display text-[15px] font-semibold tabular-nums">{amount(header.derived.skillPoints)}</dd>
          </div>
        </dl>
        <TapNoteLine tap={tap} />
      </section>
      {fullScreen ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children({ uma, preset, derived: header.derived, settled: view.settled, now: view.now, context, content, here })}
        </div>
      ) : children({ uma, preset, derived: header.derived, settled: view.settled, now: view.now, context, content, here })}
    </div>
  )
}
