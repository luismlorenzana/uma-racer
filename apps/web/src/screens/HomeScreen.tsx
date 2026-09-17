import { TICKET_STORAGE_CAP, isGateLevel } from '@racer/domain'
import { m } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { setFeaturedUma } from '../game/actions'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { AtlasSprite } from '../ui/AtlasSprite'
import { GameButton } from '../ui/GameButton'
import { Meter } from '../ui/Meter'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

export function HomeScreen() {
  const navigate = useNavigate()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const error = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const persistent = useGame((state) => state.persistent)
  const pushToast = useGame((state) => state.pushToast)

  const featured = useMemo(() => {
    if (contentState.status !== 'ready') return null
    const valid = Object.values(owned)
      .map((save) => joinUma(save, contentState.content))
      .flatMap((joined) => (joined.status === 'ready' ? [joined.value] : []))
      .sort((left, right) => left.save.templateId.localeCompare(right.save.templateId))
    return valid.find((uma) => uma.save.templateId === profile?.featuredUmaId) ?? valid[0] ?? null
  }, [contentState, owned, profile?.featuredUmaId])

  useEffect(() => {
    if (status !== 'ready' || !profile || !featured || profile.featuredUmaId === featured.save.templateId) return
    void setFeaturedUma(featured.save.templateId).catch((reason: unknown) => {
      pushToast(reason instanceof Error ? reason.message : 'Could not repair featured Uma')
    })
  }, [featured, profile, pushToast, status])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Welcome to Uma Racer" detail="Sign in to load your private Stable." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish the private content packs to begin." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={error ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Opening Uma Racer…" detail="Loading private content and your local save." />
  if (!featured) return <ScreenState title="No playable Uma found" detail="Owned save records are preserved, but their content templates are unavailable." action={{ label: 'Open Stable', to: '/stable' }} />
  const raceUnlocked = featured.save.trainingsThisScenario >= 1 && !isGateLevel(featured.save.level)

  return (
    <div className="flex flex-col gap-4 pt-2">
      {!persistent && <Panel className="border-amber-300 bg-amber-50 py-3 text-sm font-bold">Memory only — progress cannot persist or sync in this browser.</Panel>}

      <Panel className="relative overflow-hidden bg-gradient-to-b from-white to-[#e8f6ff] p-0">
        <Link to={`/stable/${encodeURIComponent(featured.save.templateId)}`} className="flex min-h-11 flex-col items-center px-4 pt-6 pb-5">
          <m.div
            className="relative w-44 max-w-[55vw] rounded-full border-4 border-white bg-gradient-to-b from-sky-top to-sky shadow-[var(--shadow-panel)]"
            animate={{ scale: [1, 1.025, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AtlasSprite asset={featured.asset} alt={`${featured.template.name} icon`} className="rounded-full" fallback={<div className="flex h-full items-center justify-center text-7xl">🐴</div>} />
            <span className="absolute -right-1 bottom-3 rounded-full border-2 border-white bg-gold px-2.5 py-0.5 text-sm font-extrabold text-white text-outline">Lv {featured.save.level}</span>
          </m.div>
          <p className="mt-4 text-xl font-extrabold">{featured.template.name}</p>
          <p className="text-sm text-ink-soft">{featured.template.outfit ?? 'Standard outfit'}</p>
          <p className="mt-1 text-sm font-extrabold text-sky-deep">{featured.scenario?.name ?? `Tier ${featured.tier}`} · Training Level {featured.save.trainingLevel}</p>
        </Link>
        <div className="grid grid-cols-2 gap-3 border-t-2 border-white bg-white/60 p-4">
          <GameButton variant={featured.readyToPromote ? 'primary' : 'secondary'} size="lg" disabled={isGateLevel(featured.save.level) && !featured.readyToPromote} onClick={() => navigate(featured.readyToPromote ? `/scenario/${encodeURIComponent(featured.save.templateId)}/start` : `/training/${encodeURIComponent(featured.save.templateId)}`)}>{featured.readyToPromote ? 'Promote' : isGateLevel(featured.save.level) ? 'Complete' : 'Train'}</GameButton>
          <GameButton variant="go" size="lg" disabled={!raceUnlocked && !featured.readyToPromote} onClick={() => navigate(featured.readyToPromote ? `/scenario/${encodeURIComponent(featured.save.templateId)}/start` : `/race?uma=${encodeURIComponent(featured.save.templateId)}`)}>{featured.readyToPromote ? 'Next scenario' : 'Race'}</GameButton>
        </div>
        <p className="px-4 pb-4 text-center text-xs font-bold text-ink-soft">
          {featured.readyToPromote ? 'Ready to promote before racing again.' : isGateLevel(featured.save.level) ? 'Latest scenario complete.' : raceUnlocked ? 'Progression races are open.' : 'Train once to unlock saved-Uma races.'}
        </p>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between">
          <p className="font-extrabold">🎫 Training tickets</p>
          <p className="text-sm font-extrabold text-ink-soft">{profile.tickets} / {TICKET_STORAGE_CAP}</p>
        </div>
        <div className="mt-2"><Meter value={profile.tickets / TICKET_STORAGE_CAP} color="linear-gradient(90deg,#ffd65a,#f2b807)" height={12} /></div>
        <p className="mt-2 text-xs text-ink-soft">+50 every local day · grants accrue to the 500 daily-storage cap</p>
      </Panel>

      <Panel className="bg-gradient-to-br from-[#fff4d6] to-white">
        <p className="font-extrabold">🏁 Progression races</p>
        <p className="mt-1 text-sm text-ink-soft">Race with saved stats, earn Uma EXP and tickets, and climb toward the next scenario gate.</p>
      </Panel>
    </div>
  )
}
