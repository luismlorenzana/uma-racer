import {
  FRIENDSHIP_TRAINING_TICKET_COST,
  MAX_STARS,
  SCENARIOS,
  STATS,
  cardStars,
  cardNodeValue,
  cardRaceBonus,
  cardGoldSkillIds,
  cardShares,
  cardSpPerNode,
  paysSkillPoints,
  scenarioForTier,
  type SkillTemplate,
  type StatKey,
  type SupportCardTemplate,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { getContentAsset, type ContentAsset } from '../content/runtime'
import { unlockCard } from '../game/actions'
import { friendshipTrainingHref } from '../game/bond-links'
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
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons'
import { SkillIcon } from '../ui/SkillIcon'
import { SkillKindBadge } from '../ui/SkillKindBadge'
import { TypeIcon } from '../ui/TypeIcon'

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
  const [openSkill, setOpenSkill] = useState<string | null>(null)
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
  const raceBonus = cardRaceBonus(template, 1)
  const raceBonusMax = cardRaceBonus(template, MAX_STARS)
  // Each node it fills pays the next of its golds and the next of its whites (D182).
  const goldSkills = cardGoldSkillIds(template, content.skills.byId).flatMap((id) => content.skills.byId.get(id) ?? [])
  const whiteSkills = template.hintSkillIds.flatMap((id) => content.skills.byId.get(id) ?? [])
  const holders = Object.values(umas)
    .flatMap((uma) => uma.scenarios
      .filter((run) => run.cardSetIds.includes(cardId))
      .map((run) => ({ umaId: uma.templateId, tier: run.tier, active: run.tier === uma.unlockedTier })))
    // Highest level first, as every Uma list is (D181), then her newest scenario.
    .sort((left, right) => (umas[right.umaId]?.level ?? 0) - (umas[left.umaId]?.level ?? 0) || right.tier - left.tier ||
      left.umaId.localeCompare(right.umaId))

  const unlock = async () => {
    if (busy) return
    setBusy(true)
    try {
      await unlockCard(cardId)
      navigate(`/collection/reveal/card/${encodeURIComponent(cardId)}`, { replace: true })
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not unlock this card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Link to="/cards" className="flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-ink-soft"><ChevronLeftIcon size={20} />Cards</Link>

      {/* ── The card ─────────────────────────────────────────────────── */}
      <CardHero
        hasArt={content.art.has('card', cardId)}
        art={art}
        icon={getContentAsset(content, 'card-icons', cardId)}
        name={template.charName}
        title={template.title || 'Support card'}
        type={template.type}
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
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold">
              {STATS.filter((stat) => (shares[stat] ?? 0) > 0).map((stat) => (
                <span key={stat} className="inline-flex items-center gap-1">
                  <TypeIcon type={stat} size={18} />
                  {titleCase(stat)} <span className="text-ink-soft">{shares[stat]}</span>
                </span>
              ))}
            </p>
          </>
        )}

        {/* A card is owned only with a Card Select Coupon (D198); tickets never buy one. */}
        {!save && (
          <div className="mt-3 grid gap-2">
            <Button disabled={busy || profile.cardCoupons < 1} onClick={() => void unlock()}>
              {profile.cardCoupons > 0 ? `Use a Card Select Coupon · ${profile.cardCoupons} left` : 'Needs a Card Select Coupon'}
            </Button>
            <p className="text-center text-[11px] text-ink-soft">Every card&rsquo;s first {MAX_STARS}★ earns one coupon.</p>
          </div>
        )}
      </Panel>

      {/* ── Skills ───────────────────────────────────────────────────── */}
      {(goldSkills.length > 0 || whiteSkills.length > 0) && (
        <>
          <SectionHeading label="Skills" hint="paid node by node" />
          <Panel className="grid gap-1 p-2">
            {goldSkills.map((skill, index) => (
              <CardSkill
                key={skill.id}
                skill={skill}
                order={`Node ${index + 1}`}
                open={openSkill === skill.id}
                onToggle={() => setOpenSkill((current) => current === skill.id ? null : skill.id)}
              />
            ))}
            {whiteSkills.map((skill, index) => (
              <CardSkill
                key={skill.id}
                skill={skill}
                order={`Node ${index + 1}`}
                open={openSkill === skill.id}
                onToggle={() => setOpenSkill((current) => current === skill.id ? null : skill.id)}
              />
            ))}
          </Panel>
        </>
      )}

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
                  ) : profile.tickets >= FRIENDSHIP_TRAINING_TICKET_COST ? (
                    <Link
                      to={friendshipTrainingHref({ cardId, tier: scenario.tier, returnTo: here })}
                      className="font-display flex min-h-11 w-16 items-center justify-center rounded-md border border-accent bg-panel text-[13px] font-semibold"
                      aria-label={`Bond in ${scenario.name}: Friendship Training`}
                    >
                      Bond
                    </Link>
                  ) : (
                    <span className="w-16 text-center text-[10px] font-semibold text-ink-faint">need {FRIENDSHIP_TRAINING_TICKET_COST}</span>
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
                    <ChevronRightIcon size={16} className="text-ink-faint" />
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
  type: SupportCardTemplate['type']
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
      {/* Its type, as the original marks a card (D182). */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 drop-shadow-md">
        <TypeIcon type={type} size={40} title={titleCase(type)} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pt-12 pb-3 text-ink-on-dark">
        <div className="flex flex-wrap gap-1">
          <Crest>{titleCase(type)}</Crest>
          <Crest tone={owned ? 'accent' : 'neutral'}>{owned ? 'Owned' : 'Not owned'}</Crest>
        </div>
        <h1 className="font-display mt-1.5 text-2xl leading-tight font-bold">{name}</h1>
        <p className="text-[13px] text-ink-on-dark-soft">{title}</p>
      </div>
    </div>
  )
}

/** One of the card's skills: its icon, name and kind, opening to what it does and its base cost (D182). */
function CardSkill({
  skill,
  order,
  open,
  onToggle,
}: {
  skill: SkillTemplate
  order: string
  open: boolean
  onToggle: () => void
}) {
  const gold = skill.kind === 'gold'
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`w-full rounded-md px-2 py-1.5 text-left ${gold ? 'border border-accent/50 bg-accent-wash' : 'bg-sunken'}`}
    >
      <span className="flex items-center gap-2">
        <SkillIcon skill={skill} size={gold ? 36 : 28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{skill.name}</span>
          <span className="flex items-center gap-1.5"><SkillKindBadge kind={skill.kind} /><span className="text-micro">{order}</span></span>
        </span>
        {skill.costSp !== null && <span className="shrink-0 text-[11px] font-semibold text-ink-soft tabular-nums">{skill.costSp} SP</span>}
      </span>
      {open && <span className="mt-1.5 block text-[12px] leading-snug text-ink-soft">{skill.description || 'No description in this content pack.'}</span>}
    </button>
  )
}
