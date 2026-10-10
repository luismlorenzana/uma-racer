import { DAILY_TICKETS, TICKET_STORAGE_CAP, badgeStateId, awaitingAdvance } from '@racer/domain'
import { m } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { setFeaturedUma } from '../game/actions'
import { buildHomeGoalState } from '../game/goals-view'
import { buildUmaFlairSummary } from '../game/flair-view'
import { buildStableRecentFlair } from '../game/trainer-view'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { AtlasSprite, atlasImageStyle } from '../ui/AtlasSprite'
import { Button } from '../ui/Button'
import { Crest } from '../ui/Crest'
import { Meter } from '../ui/Meter'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { FlairCards } from '../ui/FlairCards'
import { FarmHomeCard } from '../ui/farm/FarmHomeCard'
import { RpgHomeCard } from '../ui/rpg/RpgHomeCard'
import { PuzzleHomeCard } from '../ui/puzzles/PuzzleHomeCard'
import { CheckIcon, ChevronRightIcon } from '../ui/icons'

export function HomeScreen() {
  const navigate = useNavigate()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const error = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const farmStats = useGame((state) => state.farmStats)
  const persistent = useGame((state) => state.persistent)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const pushToast = useGame((state) => state.pushToast)

  const featured = useMemo(() => {
    if (contentState.status !== 'ready' || farmStats.mode === 'recovery') return null
    const valid = Object.values(owned)
      .map((save) => joinUma(save, contentState.content, cards, undefined, undefined, farmStats))
      .flatMap((joined) => (joined.status === 'ready' ? [joined.value] : []))
      // Without a featured Uma, the one furthest along (D181).
      .sort((left, right) => right.save.level - left.save.level || left.template.name.localeCompare(right.template.name))
    return valid.find((uma) => uma.save.templateId === profile?.featuredUmaId) ?? valid[0] ?? null
  }, [contentState, owned, profile?.featuredUmaId, cards, farmStats])

  const flairSummary = useMemo(() => {
    if (contentState.status !== 'ready' || !featured) return null
    const state = badges[badgeStateId(featured.save.templateId)]
    return state?.scope === 'uma' ? buildUmaFlairSummary(contentState.content, state, flairEvents) : null
  }, [badges, contentState, featured, flairEvents])
  const stableRecent = useMemo(() => contentState.status === 'ready'
    ? buildStableRecentFlair(contentState.content, badges, owned, flairEvents, 3) : [],
  [badges, contentState, flairEvents, owned])

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
  if (status === 'error') return <SaveErrorState detail={error} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Opening Uma Racer…" detail="Loading private content and your local save." />
  if (farmStats.mode === 'recovery') return <div className="flex flex-col gap-3"><ScreenState title="Farm stats need recovery" detail={farmStats.error} action={{ label: 'Open Farm', to: '/farm' }} /><RpgHomeCard content={contentState.content} /><PuzzleHomeCard content={contentState.content} /></div>
  if (!featured) return <ScreenState title="No playable Uma found" detail="Owned save records are preserved, but their content templates are unavailable." action={{ label: 'Open Stable', to: '/stable' }} />

  const setupPending = !featured.run.started
  const atGate = awaitingAdvance(featured.save)
  const raceUnlocked = featured.run.started && !atGate
  const goals = buildHomeGoalState(featured.save, contentState.content)
  const umaHref = `/stable/${encodeURIComponent(featured.save.templateId)}`
  const trainLabel = setupPending ? 'Set up' : featured.readyToAdvance ? 'Next scenario' : 'Constellation'
  const raceLabel = setupPending ? 'Start scenario' : featured.readyToAdvance ? 'Next scenario' : 'Race'
  const statusLine = setupPending
    ? 'Start this scenario before racing.'
    : featured.readyToAdvance ? 'Ready to unlock the next scenario.'
    : atGate ? 'Latest scenario complete.'
    : goals.kind === 'active' && goals.next ? `Next goal: ${goals.next.race?.name ?? goals.next.raceName}`
    : 'Progression races are open.'

  return (
    <div className="flex flex-col gap-3 pt-1">
      {!persistent && (
        <Panel className="border-warning/40 bg-warning/10 py-3 text-sm">
          Memory only — progress cannot persist or sync in this browser.
        </Panel>
      )}

      {/* Hero: the portrait is the screen. A blurred copy of the same art fills behind it, so a
          128 px source never has to stretch across the viewport. */}
      <section className="relative isolate overflow-hidden rounded-md border border-hairline bg-stage shadow-2">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 blur-2xl" aria-hidden>
          {featured.asset && (
            <div className="relative h-full w-full scale-125">
              <img src={featured.asset.url} alt="" aria-hidden draggable={false} style={atlasImageStyle(featured.asset)} />
            </div>
          )}
        </div>
        <div className="art-scrim pointer-events-none absolute inset-0 -z-10" aria-hidden />

        <Link to={umaHref} className="flex items-end gap-3 p-4 pb-3">
          <div className="chamfer-tr relative h-28 w-28 shrink-0 overflow-hidden rounded-md border border-white/25 shadow-2">
            <AtlasSprite
              asset={featured.asset}
              alt={`${featured.template.name} portrait`}
              className="h-full w-full"
              fallback={<Placeholder label={featured.template.name} />}
            />
          </div>
          <div className="min-w-0 flex-1 pb-1 text-ink-on-dark">
            <p className="text-micro text-ink-on-dark-soft">{featured.scenario?.name ?? `Tier ${featured.tier}`}</p>
            <p className="font-display truncate text-2xl font-bold tracking-tight">{featured.template.name}</p>
            <p className="truncate text-[13px] text-ink-on-dark-soft">{featured.template.outfit ?? 'Standard outfit'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Crest tone="accent">Lv <Numeral>{featured.save.level}</Numeral></Crest>
              <Crest className="numeral-on-dark">{profile.schemaVersion === 16 ? 'CL' : 'TL'} {featured.derived.trainingLevel}</Crest>
              {flairSummary && flairSummary.frame.label !== 'Plain' && <Crest>{flairSummary.frame.label}</Crest>}
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-stage/60 p-3 backdrop-blur-sm">
          <Button
            variant="secondary"
            size="lg"
            disabled={!setupPending && atGate && !featured.readyToAdvance}
            onClick={() => navigate(setupPending || featured.readyToAdvance ? `/stable/${encodeURIComponent(featured.save.templateId)}` : `/constellation/${encodeURIComponent(featured.save.templateId)}`)}
          >
            {trainLabel}
          </Button>
          <Button
            size="lg"
            disabled={!setupPending && !raceUnlocked && !featured.readyToAdvance}
            onClick={() => navigate(setupPending || featured.readyToAdvance ? `/stable/${encodeURIComponent(featured.save.templateId)}` : `/race?uma=${encodeURIComponent(featured.save.templateId)}`)}
          >
            {raceLabel}
          </Button>
          <p className="col-span-2 text-center text-[12px] text-ink-on-dark-soft">{statusLine}</p>
        </div>
      </section>

      <Panel label={goals.kind === 'active' && goals.career ? 'Career' : 'Scenario goals'}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft">
            {goals.kind === 'active'
              ? `${goals.stage ? `${goals.stage} · ` : ''}${goals.completed} of ${goals.goals.length} won · Tier ${goals.tier}`
              : goals.detail}
          </p>
          {goals.kind === 'active' && (
            <div className="flex gap-1" aria-label={`${goals.completed} of ${goals.goals.length} goals complete`}>
              {goals.goals.flatMap((goal) => goal.pips.length > 0
                ? goal.pips.map((pip) => ({ key: `${goal.id}:${pip.key}`, status: pip.status }))
                : [{ key: goal.id, status: goal.status }]).map((pip) => (
                <span
                  key={pip.key}
                  className={`h-2.5 w-2.5 rounded-full border ${pip.status === 'completed' ? 'border-accent bg-accent' : pip.status === 'missed' ? 'border-hairline-strong bg-hairline' : 'border-hairline-strong bg-sunken'}`}
                />
              ))}
            </div>
          )}
        </div>
        {goals.kind === 'active' && (
          <div className="mt-2 divide-y divide-[var(--color-hairline)]">
            {goals.goals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                disabled={goal.status !== 'active' || goal.race === null || !raceUnlocked}
                onClick={() => {
                  if (goal.raceId) navigate(`/race?uma=${encodeURIComponent(featured.save.templateId)}&goal=${encodeURIComponent(goal.raceId)}`)
                }}
                className="flex min-h-12 w-full items-center gap-3 py-2 text-left disabled:opacity-55"
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    goal.status === 'completed' ? 'bg-accent text-ink' : 'border border-hairline-strong text-ink-faint'
                  }`}
                >
                  {goal.status === 'completed' ? <CheckIcon size={16} title="Complete" /> : goal.race ? '' : '!'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{goal.label} · {goal.raceName}</span>
                  <span className="block truncate text-[12px] text-ink-soft">{goal.rule}{goal.race ? '' : ' · target content missing'}</span>
                  {goal.pips.length > 0 && (
                    <span className="mt-1 flex gap-1" aria-label={`${goal.pips.filter((pip) => pip.status === 'completed').length} of ${goal.pips.length} series legs complete`}>
                      {goal.pips.map((pip) => (
                        <span
                          key={pip.key}
                          title={pip.raceName}
                          className={`h-2.5 w-2.5 rounded-full ${pip.status === 'completed' ? 'bg-accent' : pip.status === 'missed' ? 'bg-hairline' : 'border border-hairline-strong bg-sunken'}`}
                        />
                      ))}
                    </span>
                  )}
                </span>
                {goal.status === 'active' && goal.race && raceUnlocked && <ChevronRightIcon size={20} className="text-ink-faint" />}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel label="Training tickets">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl font-bold">
            <Numeral>{profile.tickets}</Numeral>
            <span className="text-[13px] font-medium text-ink-faint"> / {TICKET_STORAGE_CAP}</span>
          </p>
          <p className="text-[12px] text-ink-soft">+{DAILY_TICKETS} each local day</p>
        </div>
        <div className="mt-2">
          <Meter value={profile.tickets / TICKET_STORAGE_CAP} color="var(--color-accent)" height={6} />
        </div>
      </Panel>

      <FarmHomeCard />
      <PuzzleHomeCard content={contentState.content} />
      <RpgHomeCard content={contentState.content} />

      {flairSummary && (
        <Panel label="Recent flair">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-soft">
              {flairSummary.frame.label} frame · <Numeral>{flairSummary.prestige}</Numeral> Prestige
            </p>
            <Link
              to={`/badges?uma=${encodeURIComponent(featured.save.templateId)}`}
              className="flex min-h-11 items-center gap-0.5 text-[13px] font-semibold text-accent-strong"
            >
              All badges
              <ChevronRightIcon size={16} />
            </Link>
          </div>
          {flairSummary.recent.length > 0 ? (
            <FlairCards items={flairSummary.recent} />
          ) : (
            <p className="rounded-sm bg-sunken p-3 text-[13px] text-ink-soft">
              Race, Train, and complete Journeys to begin this Uma’s archive.
            </p>
          )}
        </Panel>
      )}
      <Panel label="Stable flair">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft">Newest across every Uma and Trainer achievement</p>
          <Link to="/trainer" className="flex min-h-11 items-center gap-0.5 text-[13px] font-semibold text-accent-strong">Trainer<ChevronRightIcon size={16} /></Link>
        </div>
        {stableRecent.length > 0 ? (
          <div className="divide-y divide-[var(--color-hairline)]">
            {stableRecent.map((item) => (
              <Link key={item.id} to={item.to} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{item.label}</span>
                  <span className="block truncate text-[12px] text-ink-soft">{item.ownerLabel}</span>
                </span>
                <span className="text-micro shrink-0 text-accent-strong">{item.stage}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-sm bg-sunken p-3 text-[13px] text-ink-soft">Stable-wide flair appears after the first award.</p>
        )}
      </Panel>

      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1], delay: 0.08 }}
        className="px-1 pb-2 text-center text-[12px] text-ink-faint"
      >
        Race with saved stats, earn EXP and tickets, climb toward the next gate.
      </m.p>
    </div>
  )
}
