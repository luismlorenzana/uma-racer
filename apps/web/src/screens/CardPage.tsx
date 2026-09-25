import {
  BOND_RECALL_TICKET_COST,
  MAX_STARS,
  SCENARIOS,
  STATS,
  cardStars,
  cardNodeValue,
  cardRaceBonus,
  cardShares,
  cardUnlockCost,
  cardSpPerNode,
  paysSkillPoints,
  scenarioForTier,
  type StatKey,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { getContentAsset, type ContentAsset } from '../content/runtime'
import { unlockCard } from '../game/actions'
import { bondRecallHref } from '../game/bond-links'
import { useGame } from '../game/store'
import { ArtViewer, ExpandMark } from '../ui/ArtViewer'
import { AtlasSprite } from '../ui/AtlasSprite'
import { Stars } from '../ui/Stars'
import { Button } from '../ui/Button'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { useArt } from '../ui/album/useArt'
import { SectionHeading } from '../ui/Section'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)
const STAT_TONE: Record<StatKey, string> = {
  speed: 'var(--color-stat-speed)',
  stamina: 'var(--color-stat-stamina)',
  power: 'var(--color-stat-power)',
  guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)',
}
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`

/**
 * One card: owning it at the top, its power in each scenario in the middle, and everything else below — the same
 * three zones as the Uma profile (M016).
 */
export function CardPage() {
  const { cardId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const profile = useGame((state) => state.profile)
  const cards = useGame((state) => state.cards)
  const umas = useGame((state) => state.umas)
  const pushToast = useGame((state) => state.pushToast)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(false)
  const art = useArt(contentState.status === 'ready' ? contentState.content : null, 'card', cardId || null)

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to view this card" detail="Your card collection is part of your private save." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) {
    return <ScreenState title="Opening card…" detail="Loading private content and your local save." />
  }
  const content = contentState.content
  const template = content.cards.byId.get(cardId)
  if (!template) return <ScreenState title="Card not found" detail="This card is not in the current content pack." action={{ label: 'Back to Cards', to: '/cards' }} />

  const save = cards[cardId] ?? null
  const here = `/cards/${encodeURIComponent(cardId)}`
  const highestTier = Math.max(1, ...Object.values(umas).map((uma) => uma.unlockedTier))
  const lensTier = Number(params.get('tier')) || null
  const reached = SCENARIOS.filter((scenario) => scenario.tier >= template.era && scenario.tier <= highestTier)
  const later = SCENARIOS.filter((scenario) => scenario.tier >= template.era && scenario.tier > highestTier)
  // The scenario the numbers below are quoted in: the lens it was opened from, else the newest one it can reach.
  const referenceTier = lensTier && lensTier >= template.era ? lensTier : reached.at(-1)?.tier ?? template.era
  const shares = cardShares(template)
  const skillPoints = paysSkillPoints(template)
  const payPerNode = skillPoints ? cardSpPerNode : cardNodeValue
  const cost = cardUnlockCost(template.era)
  const raceBonus = cardRaceBonus(template, 1)
  const raceBonusMax = cardRaceBonus(template, MAX_STARS)
  const hintSkills = template.hintSkillIds.flatMap((id) => {
    const skill = content.skills.byId.get(id)
    return skill ? [skill.name] : []
  })
  const holders = Object.values(umas)
    .flatMap((uma) => uma.scenarios
      .filter((run) => run.cardSetIds.includes(cardId))
      .map((run) => ({ umaId: uma.templateId, tier: run.tier, active: run.tier === uma.unlockedTier })))
    .sort((left, right) => right.tier - left.tier || left.umaId.localeCompare(right.umaId))

  const unlock = async (method: 'coupon' | 'tickets') => {
    if (busy) return
    setBusy(true)
    try {
      await unlockCard(cardId, method)
      navigate(`/collection/reveal/card/${encodeURIComponent(cardId)}`, { replace: true })
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not unlock this card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Link to="/cards" className="flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-ink-soft">← Cards</Link>

      {/* ── The card ─────────────────────────────────────────────────── */}
      <CardHero
        hasArt={content.art.has('card', cardId)}
        art={art}
        icon={getContentAsset(content, 'card-icons', cardId)}
        name={template.charName}
        title={template.title || 'Support card'}
        type={titleCase(template.type)}
        owned={save !== null}
        reducedMotion={reducedMotion ?? false}
        onOpen={() => setViewing(true)}
      />
      <ArtViewer src={viewing ? art : null} title={template.charName} subtitle={template.title || undefined} onClose={() => setViewing(false)} />

      <Panel className="p-3">
        <p className="text-micro">From {scenarioForTier(template.era)?.name ?? `tier ${template.era}`}</p>
        {skillPoints ? (
          <p className="mt-1 text-[12px] font-semibold text-accent-strong">Pays skill points, not stats, in any slot</p>
        ) : (
          <>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-sunken" aria-label="How one node splits">
              {STATS.filter((stat) => (shares[stat] ?? 0) > 0).map((stat) => (
                <span key={stat} style={{ width: `${shares[stat]}%`, background: STAT_TONE[stat] }} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">
              {STATS.filter((stat) => (shares[stat] ?? 0) > 0).map((stat) => `${titleCase(stat)} ${shares[stat]}`).join(' · ')}
            </p>
          </>
        )}

        {!save && (
          <div className="mt-3 grid gap-2">
            <Button disabled={busy || profile.tickets < cost} onClick={() => void unlock('tickets')}>
              Unlock · {cost} tickets
            </Button>
            {profile.cardCoupons > 0 && (
              <Button variant="secondary" disabled={busy} onClick={() => void unlock('coupon')}>
                Use a Card Select Coupon · {profile.cardCoupons} left
              </Button>
            )}
            <p className="text-center text-[11px] text-ink-soft">
              You have <Numeral className="text-ink">{profile.tickets}</Numeral> tickets
            </p>
          </div>
        )}
      </Panel>

      {/* ── Bond by scenario ─────────────────────────────────────────── */}
      <SectionHeading label="Bond by scenario" hint="shared by every Uma there" />
      <Panel className="p-2">
        {reached.length === 0 ? (
          <p className="p-2 text-[12px] text-ink-soft">
            This card arrives in {scenarioForTier(template.era)?.name ?? `tier ${template.era}`}, which none of your Umas has reached yet.
          </p>
        ) : (
          <div className="grid gap-1">
            {[...reached].reverse().map((scenario) => {
              const bond = save ? cardStars(save, scenario.tier) : 0
              const maxed = bond >= MAX_STARS
              const highlighted = scenario.tier === referenceTier
              return (
                <div key={scenario.tier} className={`flex min-h-12 items-center gap-2 rounded-md px-2 ${highlighted ? 'bg-accent-wash' : 'bg-sunken'}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{scenario.name}</span>
                    <span className="flex items-center gap-2">
                      <Stars value={bond} />
                      <span className="text-micro">{Math.round(payPerNode(scenario.tier, { template, stars: bond }))}{skillPoints ? ' SP' : ''} per node</span>
                    </span>
                  </span>
                  {!save ? null : maxed ? (
                    <span className="w-16 text-center text-[11px] font-semibold text-ink-faint">Max</span>
                  ) : profile.tickets >= BOND_RECALL_TICKET_COST ? (
                    <Link
                      to={bondRecallHref({ cardId, tier: scenario.tier, returnTo: here })}
                      className="font-display flex min-h-10 w-16 items-center justify-center rounded-md border border-accent bg-panel text-[13px] font-semibold"
                    >
                      Bond
                    </Link>
                  ) : (
                    <span className="w-16 text-center text-[10px] font-semibold text-ink-faint">need {BOND_RECALL_TICKET_COST}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {later.length > 0 && (
          <p className="px-2 pt-2 pb-1 text-[11px] text-ink-faint">
            {later.length} later scenario{later.length === 1 ? '' : 's'} open{later.length === 1 ? 's' : ''} as your Umas reach them — each starts at 0★.
          </p>
        )}
        {!save && reached.length > 0 && <p className="px-2 pt-2 pb-1 text-[11px] text-ink-soft">Unlock the card to bond it.</p>}
      </Panel>

      {/* ── What it pays ─────────────────────────────────────────────── */}
      <SectionHeading label="What it pays" hint={scenarioForTier(referenceTier)?.name} />
      <Panel className="p-3">
        <p className="text-micro mb-1">One node it fills, by stars{skillPoints ? ' · skill points' : ''}</p>
        <div className="grid grid-cols-3 gap-1 text-center">
          {Array.from({ length: MAX_STARS + 1 }, (_, bond) => {
            const current = save ? cardStars(save, referenceTier) === bond : false
            return (
              <div key={bond} className={`rounded-md px-1 py-1.5 ${current ? 'bg-accent-wash outline outline-1 outline-accent' : 'bg-sunken'}`}>
                <Numeral className="block text-[14px] leading-none">{Math.round(payPerNode(referenceTier, { template, stars: bond }))}</Numeral>
                <span className="text-micro">{bond === MAX_STARS ? `${bond}★ Max` : `${bond}★`}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] text-ink-soft">
          {skillPoints
            ? 'Friend and Group cards pay skill points instead of stats, whichever slot of the set they sit in.'
            : `It pays its stats in any slot. Skill points come from Friend and Group cards.`}
        </p>
        {raceBonus > 0 && (
          <p className="mt-1 text-[12px] text-ink-soft">
            While it is in the active set it adds {percent(raceBonus)} to race EXP at 1★, rising to {percent(raceBonusMax)} at {MAX_STARS}★.
          </p>
        )}
        {hintSkills.length > 0 && (
          <div className="mt-3">
            <p className="text-micro mb-1">Skills · one per node it fills, in this order</p>
            <ol className="grid gap-0.5">
              {hintSkills.map((name, index) => (
                <li key={name} className="flex gap-2 text-[12px]">
                  <span className="w-4 shrink-0 text-right text-ink-faint">{index + 1}</span>
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Panel>

      {/* ── In card sets ─────────────────────────────────────────────── */}
      {holders.length > 0 && (
        <>
          <SectionHeading label="In card sets" hint={`${holders.length}`} />
          <Panel className="p-2">
            <div className="grid gap-1">
              {holders.map((holder) => {
                const name = content.umas.byId.get(holder.umaId)?.name ?? holder.umaId
                const label = `${name} · ${scenarioForTier(holder.tier)?.name ?? `Tier ${holder.tier}`}`
                return holder.active ? (
                  <Link
                    key={`${holder.umaId}:${holder.tier}`}
                    to={`/constellation/${encodeURIComponent(holder.umaId)}/cards`}
                    className="flex min-h-11 items-center justify-between rounded-md bg-sunken px-2 text-[12px] font-semibold"
                  >
                    <span className="truncate">{label}</span>
                    <span aria-hidden className="text-ink-faint">›</span>
                  </Link>
                ) : (
                  <p key={`${holder.umaId}:${holder.tier}`} className="flex min-h-11 items-center rounded-md px-2 text-[12px] text-ink-soft">
                    {label} · earlier scenario
                  </p>
                )
              })}
            </div>
          </Panel>
        </>
      )}
      {save?.maxCouponGranted && (
        <p className="px-1 pb-2 text-center text-[11px] font-semibold text-accent-strong">This card has earned its Card Select Coupon.</p>
      )}
    </div>
  )
}

/**
 * The card's illustration, full width at the top of its page (docs/design/ux.md#cards): the 450×600 art cropped to
 * 4:5 from the top, with its name over a gradient at the foot. The icon shows blurred until the art arrives; a tap
 * opens the whole illustration. A card with no published illustration gets a shorter frame around its icon.
 */
function CardHero({
  hasArt,
  art,
  icon,
  name,
  title,
  type,
  owned,
  reducedMotion,
  onOpen,
}: {
  hasArt: boolean
  art: string | null
  icon: ContentAsset | null
  name: string
  title: string
  type: string
  owned: boolean
  reducedMotion: boolean
  onOpen: () => void
}) {
  const tone = owned ? '' : 'saturate-[.35] brightness-[.8]'
  return (
    <div className={`relative isolate w-full overflow-hidden rounded-lg border border-hairline bg-stage shadow-2 ${hasArt ? 'aspect-[4/5]' : 'aspect-[16/10]'}`}>
      {hasArt ? (
        <>
          <AtlasSprite asset={icon} decorative className={`absolute inset-0 h-full w-full scale-110 blur-md ${tone}`} />
          {art && (
            <>
              <m.img
                key={art}
                src={art}
                alt={`${name} support card`}
                draggable={false}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className={`absolute inset-0 h-full w-full object-cover object-top ${tone}`}
              />
              <button type="button" onClick={onOpen} aria-label={`View ${name}'s illustration`} className="absolute inset-0 z-10">
                <ExpandMark className="absolute right-3 top-3" />
              </button>
            </>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-stage-soft to-stage pt-5">
          <AtlasSprite asset={icon} alt={`${name} support card`} className={`w-1/4 rounded-md ${tone}`} fallback={<Placeholder label={name} />} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pt-12 pb-3 text-ink-on-dark">
        <div className="flex flex-wrap gap-1">
          <Crest>{type}</Crest>
          <Crest tone={owned ? 'accent' : 'neutral'}>{owned ? 'Owned' : 'Not owned'}</Crest>
        </div>
        <h1 className="font-display mt-1.5 text-2xl leading-tight font-bold">{name}</h1>
        <p className="text-[13px] text-ink-on-dark-soft">{title}</p>
      </div>
    </div>
  )
}
