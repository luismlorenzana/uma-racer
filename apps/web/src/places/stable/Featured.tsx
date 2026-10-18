// The featured Uma (docs/game/11-hub-and-places.md §5; T138, SA7): `FeaturedUmaCard`, the Stable Peek's first card;
// `PlazaFigure`, one of the Town Hall plaza's crowd; and the quick sheet: her name, tier crest, scenario, Racing Level and what she's doing
// ("Kitchen · 2 of 4 · 2h 10m"); Train (her Needs), Race (the Racecourse with her picked), Profile, and Feature another
// Uma through the one Uma picker, which runs `feature-uma`. The sheet shows the Uma tapped in the crowd (`&uma=`), else the
// featured one.
import { navState, withParam } from '@luismlorenzana/uma-kit/shell'
import { Button, TierCrest } from '@luismlorenzana/uma-kit/ui'
import { hubWords } from '@racer/domain/hub'
import { scenarioNumber, scenarioRow } from '@racer/domain/tiers'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useGame, useHub, useNow } from '../../app/game'
import { TapNoteLine, useTap } from '../../ui/work'
import { UmaBust, UmaChibi } from '@luismlorenzana/uma-kit/album'
import { RacerUmaPicker as UmaPicker } from '../../ui/racerAlbum'
import type { FeaturedSheetProps, PlazaFigureProps, PlazaProps } from '../registry'
import { doingNow, doingWords } from './model'

/** Her card: still art and her name; a tap opens her quick sheet (`?sheet=featured`). Empty with no Umas. */
export function FeaturedUmaCard({ umaId }: PlazaProps) {
  const location = useLocation()
  const name = useGame((snapshot) => (umaId === null ? '' : snapshot.env?.content.umas.get(umaId)?.name ?? ''))
  const tier = useGame((snapshot) => (umaId === null ? null : snapshot.state?.umas[umaId]?.tier ?? null))
  if (umaId === null) return null
  return (
    <Link
      to={withParam(location, 'sheet', 'featured')}
      state={{ back: true }}
      aria-label={hubWords('featured', { uma: name })}
      data-g2="featured-card"
      className="flex min-h-24 min-w-24 flex-col items-center justify-center gap-1 rounded-md p-1 active:bg-ink/5"
    >
      <span className="relative">
        <UmaBust outfitId={umaId} label={name} size={72} className="size-18 overflow-hidden rounded-sm" />
        {tier !== null && <TierCrest tier={tier} className="absolute -right-2 -bottom-1" />}
      </span>
      <span aria-hidden className="max-w-28 truncate rounded-full border border-accent/40 bg-accent-wash px-2 py-0.5 text-[11px] leading-4 font-semibold text-ink">{name}</span>
    </Link>
  )
}

/**
 * One Uma in the Town Hall plaza's crowd (§5, SA7): her 44 pt art (chibi, else bust, icon or initial), no name on the
 * map. A tap opens her quick sheet (`?sheet=featured&uma=:id`); the featured Uma stands in front.
 */
export function PlazaFigure({ umaId, front }: PlazaFigureProps) {
  const location = useLocation()
  const name = useGame((snapshot) => snapshot.env?.content.umas.get(umaId)?.name ?? '')
  const params = new URLSearchParams(location.search)
  params.set('sheet', 'featured')
  params.set('uma', umaId)
  return (
    <Link
      to={`${location.pathname}?${params.toString()}`}
      state={{ back: true }}
      aria-label={hubWords(front ? 'featured' : 'crowd-figure', { uma: name })}
      data-g2="plaza-figure"
      data-uma={umaId}
      className="flex size-11 items-end justify-center rounded-md active:bg-ink/5"
    >
      <UmaChibi outfitId={umaId} label={name} size={44} className="size-11" />
    </Link>
  )
}

/** Her quick sheet (§5): the Uma tapped in the plaza's crowd, else the featured one. */
export function FeaturedSheet({ umaId, onClose }: FeaturedSheetProps) {
  const location = useLocation()
  const now = useNow()
  const view = useHub()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const tap = useTap()
  const [picking, setPicking] = useState(false)
  const featured = umaId !== null && state?.umas[umaId] !== undefined ? umaId : view?.featured ?? umaId
  const uma = featured === null ? null : state?.umas[featured] ?? null
  const doing = useMemo(() => (state === null || env === null || uma === null ? null : doingNow(state, uma.outfitId, now, env)), [state, env, uma, now])
  if (uma === null || env === null) return <h2 data-sheet-heading tabIndex={-1} className="pb-2 text-lg outline-none">{hubWords('no-umas')}</h2>
  const name = env.content.umas.get(uma.outfitId)?.name ?? uma.outfitId
  const id = encodeURIComponent(uma.outfitId)
  const back = navState(location).back
  const links: readonly [string, string][] = [
    [hubWords('train'), `/town/stable/outfit/${id}/needs`],
    [hubWords('race'), `/racing/racecourse?uma=${id}`],
    [hubWords('profile'), `/town/stable/outfit/${id}`],
  ]
  return (
    <div data-g2="featured-sheet">
      <div className="flex items-center gap-3 pb-3">
        <UmaBust outfitId={uma.outfitId} label={name} size={64} className="size-16 shrink-0 overflow-hidden rounded-sm" />
        <div className="min-w-0">
          <h2 data-sheet-heading tabIndex={-1} className="flex items-center gap-2 text-lg outline-none">
            <span className="truncate">{name}</span>
            <TierCrest tier={uma.tier} />
          </h2>
          <p className="text-[13px] text-ink-soft">{scenarioRow(scenarioNumber(uma)).name} · Racing Lv {uma.racing.level}</p>
          {doing !== null && <p className="text-[13px] font-semibold" data-g2="doing">{doingWords(doing, now)}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {links.map(([label, to]) => (
          <Link key={to} to={to} replace state={{ back }} className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel font-semibold shadow-1">
            {label}
          </Link>
        ))}
      </div>
      <Button variant="secondary" className="mt-2 w-full" disabled={tap.pending !== null} onClick={() => setPicking(true)}>Feature another Uma</Button>
      <TapNoteLine tap={tap} className="mt-2" />
      <UmaPicker
        open={picking}
        onClose={() => setPicking(false)}
        title="Feature an Uma"
        selectedIds={[uma.outfitId]}
        selectedLabel="Featured"
        disabledReason={(entry) => (entry.id === uma.outfitId ? 'Featured now' : null)}
        onPick={(outfitId) => {
          void tap.run('feature-uma', { outfitId }, 'feature-uma').then((answer) => {
            if (answer?.kind === 'done') onClose()
          })
        }}
      />
    </div>
  )
}
