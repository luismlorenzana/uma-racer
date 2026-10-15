// The featured Uma (docs/rework/11-hub-and-places.md §5; T138): `FeaturedUmaCard`, the Town Hall plaza's cell and the
// Stable Peek's first card, and her quick sheet: her name, tier crest, scenario, Racing Level and what she's doing
// ("Kitchen · 2 of 4 · 16:40"); Train (her Needs), Race (the Racecourse with her picked), Profile, and Feature another
// Uma through the one Uma picker, which runs `feature-uma`. The plaza's chibi and its animation are phase 6 (§11).
import { hubWords } from '@racer/domain/hub'
import { scenarioNumber, scenarioRow } from '@racer/domain/rework/tiers'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '../../ui/Button'
import { Crest } from '../../ui/Crest'
import { useGame, useHub, useNow, useRuntime } from '../../app/game'
import { navState, withParam } from '../../hub/nav'
import { TapNoteLine, useTap } from '../../ui/work'
import { UmaArt } from '../../ui/UmaArt'
import { UmaPicker } from '../../ui/UmaPicker'
import type { FeaturedSheetProps, PlazaProps } from '../registry'
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
        <UmaArt outfitId={umaId} size={72} />
        {tier !== null && <Crest className="absolute -right-2 -bottom-1">T{tier}</Crest>}
      </span>
      <span aria-hidden className="max-w-28 truncate rounded-full border border-accent/40 bg-accent-wash px-2 py-0.5 text-[11px] leading-4 font-semibold text-ink">{name}</span>
    </Link>
  )
}

/** Her quick sheet (§5). */
export function FeaturedSheet({ umaId, onClose }: FeaturedSheetProps) {
  const location = useLocation()
  const { game } = useRuntime()
  const now = useNow()
  const view = useHub()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const tap = useTap()
  const [picking, setPicking] = useState(false)
  const featured = view?.featured ?? umaId
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
        <UmaArt outfitId={uma.outfitId} size={64} />
        <div className="min-w-0">
          <h2 data-sheet-heading tabIndex={-1} className="flex items-center gap-2 text-lg outline-none">
            <span className="truncate">{name}</span>
            <Crest>T{uma.tier}</Crest>
          </h2>
          <p className="text-[13px] text-ink-soft">{scenarioRow(scenarioNumber(uma)).name} · Racing Lv {uma.racing.level}</p>
          {doing !== null && <p className="text-[13px] font-semibold" data-g2="doing">{doingWords(doing, game.utcOffsetMin(now))}</p>}
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
