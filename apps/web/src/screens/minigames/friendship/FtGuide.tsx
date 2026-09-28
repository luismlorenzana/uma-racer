import {
  CARD_EFFECTS,
  FRIENDSHIP_TRAINING_TICKET_COST,
  FT_BOND_GAUGE,
  FT_CARD_POINTS,
  FT_FACILITY_GRADES,
  FT_FORMATIONS,
  FT_HAND_SIZE,
  FT_MAX_TRAIN,
  FT_RACE_PAYOUT,
  FT_RACE_TRAINS,
  FT_RAINBOW_MAX_EXTRA,
  FT_REDRAWS,
  FT_RIVAL_RULES,
  FT_RIVAL_RULE_IDS,
  FT_SHOP_PRICES,
  FT_SIGNATURE_MULT,
  FT_SKILL_RULES,
  FT_SKILL_SLOTS,
  FT_STAGES,
  FT_STRENGTH_PER_STAR,
  FT_TRAITS,
  FT_TWISTS,
  FT_UNUSED_TRAIN_FANS,
  FT_WEEK_TARGETS,
  FT_WEEK_TRAINS,
  ftFavouredTypes,
  scenarioForTier,
  type FtCardType,
  type FtFormationId,
  type FtSkillRuleId,
  type StatKey,
} from '@racer/domain'
import type { ReactNode } from 'react'
import { PagedGuide } from '../../../ui/PagedGuide'
import { CheckIcon, HeartIcon, RaceIcon } from '../../../ui/icons'
import { createGuideMemory } from '../../../ui/minigames/guide-memory'
import { TypeIcon } from '../../../ui/TypeIcon'
import { STAT_NAMES, TypeBadge } from './FtCard'

// How to play Friendship Training (M020): a paged, illustrated guide. Every number is read from the rules module, so
// the guide changes with the balance and can never teach a stale rule.

export type GuidePageId =
  | 'goal' | 'season' | 'facility' | 'train' | 'formations' | 'points' | 'main' | 'races' | 'skills' | 'twists' | 'tips'

const GUIDE_SEEN_KEY = 'uma-racer:friendship-guide-seen'
const guideMemory = createGuideMemory(GUIDE_SEEN_KEY)
export const guideSeen = guideMemory.seen
export const rememberGuideSeen = guideMemory.remember

// ── Illustrations ───────────────────────────────────────────────────────────────────────────────────────────────────

const STAT_TINT: Readonly<Record<StatKey, string>> = {
  speed: 'bg-stat-speed/35', stamina: 'bg-stat-stamina/35', power: 'bg-stat-power/35', guts: 'bg-stat-guts/35', wit: 'bg-stat-wit/35',
}

const STAT_FILL: Readonly<Record<StatKey, string>> = {
  speed: 'bg-stat-speed/70', stamina: 'bg-stat-stamina/70', power: 'bg-stat-power/70', guts: 'bg-stat-guts/70', wit: 'bg-stat-wit/70',
}

/** A slim card for the formation rows: five fit beside the description. */
function SlimCard({ type, copy }: { type: FtCardType; copy?: string }) {
  const broad = type === 'friend' || type === 'group'
  return (
    <span className={`relative flex h-9 w-[22px] shrink-0 items-center justify-center rounded-xs border border-white/25 text-white ${broad ? 'bg-accent-strong/70' : STAT_FILL[type]}`}>
      <TypeIcon type={type} size={18} />
      {copy && <span className="absolute right-px bottom-0 text-[8px] font-bold">{copy}</span>}
    </span>
  )
}

/** A card-shaped chip in its type's colour: the guide's stand-in for a card. */
function MiniCard({ type, lifted = false, copy }: { type: FtCardType; lifted?: boolean; copy?: string }) {
  const broad = type === 'friend' || type === 'group'
  return (
    <span className={`relative flex h-12 w-9 shrink-0 items-center justify-center rounded-sm border ${lifted ? '-translate-y-1.5 border-white' : 'border-white/20'} ${broad ? 'bg-accent-strong/40' : STAT_TINT[type]}`}>
      <TypeBadge type={type} />
      {copy && <span className="absolute right-0.5 bottom-0 text-[9px] font-bold text-white/80">{copy}</span>}
    </span>
  )
}

const FORMATION_EXAMPLES: Record<FtFormationId, { cards: { type: FtCardType; copy?: string }[]; rule: string }> = {
  solo: { cards: [{ type: 'wit' }], rule: 'Any card, alone or in a mix that makes nothing better.' },
  duo: { cards: [{ type: 'power', copy: 'A' }, { type: 'power', copy: 'A' }], rule: 'Two copies of the same card.' },
  friendship: { cards: [{ type: 'speed' }, { type: 'speed' }], rule: 'Two cards of the facility’s type.' },
  trio: { cards: [{ type: 'guts', copy: 'A' }, { type: 'guts', copy: 'A' }, { type: 'guts', copy: 'A' }], rule: 'Three copies of the same card.' },
  rainbow: { cards: [{ type: 'speed' }, { type: 'speed' }, { type: 'friend' }, { type: 'speed' }], rule: `Three or more of the facility’s type. Each past three adds +1 mult, up to ×${FT_FORMATIONS.rainbow.mult + FT_RAINBOW_MAX_EXTRA}.` },
  'full-team': { cards: [{ type: 'speed' }, { type: 'stamina' }, { type: 'power' }, { type: 'guts' }, { type: 'wit' }], rule: 'One of each of the five stat types.' },
  'rainbow-team': { cards: [{ type: 'speed' }, { type: 'speed' }, { type: 'speed' }, { type: 'speed' }, { type: 'speed' }], rule: 'Five cards of the facility’s type.' },
}

function MapStrip() {
  const node = (label: ReactNode, tone: string) => <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[10px] font-bold ${tone}`}>{label}</span>
  const line = <span className="h-0.5 w-4 bg-white/30" />
  return (
    <div className="flex items-center justify-center gap-1" aria-hidden>
      {node(<CheckIcon size={16} />, 'bg-stat-speed text-white')}{line}
      {node(<CheckIcon size={16} />, 'bg-stat-guts text-white')}{line}
      {node(<span className="flex items-center gap-0.5"><RaceIcon size={16} />G3</span>, 'bg-accent text-ink rounded-sm')}
      <span className="mx-1 h-4 w-px bg-white/30" />
      {node('', 'border-2 border-accent')}{line}
      {node('', 'border border-white/30')}{line}
      {node(<span className="flex items-center gap-0.5"><RaceIcon size={16} />G2</span>, 'border border-white/30 text-white/50 rounded-sm')}
    </div>
  )
}

function Hearts({ filled, bonded = false }: { filled: number; bonded?: boolean }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: FT_BOND_GAUGE }, (_, index) => (
        <HeartIcon key={index} size={24} variant="solid" className={bonded ? 'text-accent' : index < filled ? 'text-stat-guts' : 'text-white/25'} />
      ))}
    </span>
  )
}

const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="grid gap-2 text-[14px] leading-snug">
    {items.map((item, index) => (
      <li key={index} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden /><span className="min-w-0">{item}</span></li>
    ))}
  </ul>
)

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="rounded-md border border-hairline-dark bg-stage-soft p-3">{children}</div>
)

const SKILL_ORDER: FtSkillRuleId[] = ['surge', 'corner', 'straight', 'spurt', 'kick', 'gate', 'second-wind', 'vision', 'positioning', 'aptitude', 'pressure', 'form']

// ── Pages ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function pages(tier: number): { id: GuidePageId; title: string; body: ReactNode }[] {
  const scenario = scenarioForTier(tier)?.name ?? `tier ${tier}`
  const standard = FT_FACILITY_GRADES[1]!
  return [
    {
      id: 'goal',
      title: 'Train a card, earn a star',
      body: (
        <>
          <Panel>
            <div className="flex items-center justify-center gap-3">
              <MiniCard type="guts" />
              <span className="text-[13px] text-ink-on-dark-soft">one season</span>
              <span className="font-display text-[22px] font-bold text-accent">+1★</span>
            </div>
          </Panel>
          <Bullets items={[
            <>A run trains <strong>one card</strong> in <strong>one scenario</strong>. Clear the whole season and the card gains one star there, and this run is in {scenario}.</>,
            <>A run costs {FRIENDSHIP_TRAINING_TICKET_COST} ticket, win or lose. There is no partial progress: miss a target and the run ends.</>,
            <>Stars make a card pay more on its constellation nodes, so a bonded card is worth slotting.</>,
            <>The higher the star, the longer the run: {Object.entries(FT_STAGES).map(([star, stages]) => `${star}★ ${stages} stage${stages === 1 ? '' : 's'}`).join(' · ')}.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'season',
      title: 'The season map',
      body: (
        <>
          <Panel><MapStrip /></Panel>
          <Bullets items={[
            <>Each stage is <strong>two training weeks and a race</strong>. Races grow from G3 to G2 to G1.</>,
            <>The map across the top shows where you are: cleared weeks wear their facility’s colour, the current step pulses, and the race waits at the end of each stage.</>,
            <>Leave whenever you like. The run is saved after every move, and <strong>Resume</strong> picks it up exactly where it was.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'facility',
      title: 'Choose a facility',
      body: (
        <>
          <Panel>
            <div className="grid gap-1.5">
              {(['stamina', 'wit', 'guts'] as StatKey[]).map((stat, index) => {
                const grade = FT_FACILITY_GRADES[index]!
                return (
                  <div key={stat} className="flex items-center gap-2">
                    <TypeIcon type={stat} size={28} />
                    <span className="flex-1 text-[13px] font-semibold">{STAT_NAMES[stat]} <span className="text-[10px] text-ink-on-dark-soft uppercase">{['Easy', 'Standard', 'Hard'][index]}</span></span>
                    <span className="font-display text-[14px] font-bold">{Math.round((FT_WEEK_TARGETS[0]![0] * grade.target) / 10) * 10}</span>
                    <span className="w-14 text-right text-[11px] font-semibold text-accent">+{grade.payout} fans</span>
                  </div>
                )
              })}
            </div>
          </Panel>
          <Bullets items={[
            <>Each week offers three facilities: an <strong>easy</strong>, a <strong>standard</strong> and a <strong>hard</strong> one. Harder targets pay more fans.</>,
            <>Cards of the facility’s type are <strong>on-type</strong>: they score more and build the best formations. Each facility shows how many of your cards are on-type.</>,
            <>A good rule: train where your deck is strongest, and take the hard one when your hand is ready for it. A standard week pays {standard.payout} fans.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'train',
      title: 'Train with your hand',
      body: (
        <>
          <Panel>
            <div className="flex justify-center gap-1.5">
              <MiniCard type="guts" lifted /><MiniCard type="guts" lifted /><MiniCard type="speed" /><MiniCard type="friend" lifted /><MiniCard type="stamina" /><MiniCard type="guts" lifted /><MiniCard type="wit" />
            </div>
            <p className="mt-2 text-center text-[13px]"><span className="font-semibold text-accent">Rainbow</span><span className="text-ink-on-dark-soft"> · (82) × 5 = </span><span className="font-display font-bold">410</span></p>
          </Panel>
          <Bullets items={[
            <>You hold <strong>{FT_HAND_SIZE} cards</strong>. Tap up to {FT_MAX_TRAIN} and press <strong>Train</strong>: {FT_WEEK_TRAINS} trains a week, {FT_RACE_TRAINS} in a race.</>,
            <><strong>Redraw</strong> swaps up to five selected cards for new ones, {FT_REDRAWS} times a week or race.</>,
            <>A train scores <strong>(card points + formation points) × mult</strong>. The readout shows the result before you commit.</>,
            <>Reach the target and the week is cleared at once. Every train you did not need pays {FT_UNUSED_TRAIN_FANS} fans.</>,
            <>Long-press a card to read its type, trait and points.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'formations',
      title: 'Formations',
      body: (
        <div className="grid gap-1.5">
          {(Object.keys(FORMATION_EXAMPLES) as FtFormationId[]).map((id) => (
            <div key={id} className="flex items-center gap-2 rounded-md border border-hairline-dark bg-stage-soft px-2.5 py-2">
              <span className="flex w-[118px] shrink-0 gap-0.5">{FORMATION_EXAMPLES[id].cards.map((card, index) => <SlimCard key={index} type={card.type} copy={card.copy} />)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold">{FT_FORMATIONS[id].name}</span>
                  <span className="font-display shrink-0 text-[12px] text-accent">+{FT_FORMATIONS[id].points} · ×{FT_FORMATIONS[id].mult}{id === 'rainbow' ? '+' : ''}</span>
                </span>
                <span className="block text-[11px] leading-snug text-ink-on-dark-soft">{FORMATION_EXAMPLES[id].rule}</span>
              </span>
            </div>
          ))}
          <p className="text-[12px] text-ink-on-dark-soft">Every selected card adds its points; the best formation the selection makes decides the rest.</p>
        </div>
      ),
    },
    {
      id: 'points',
      title: 'Card points and traits',
      body: (
        <>
          <Panel>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="font-display text-[22px] font-bold">{FT_CARD_POINTS.onType}</p><p className="text-[11px] text-ink-on-dark-soft">on-type</p></div>
              <div><p className="font-display text-[22px] font-bold">{FT_CARD_POINTS.offType}</p><p className="text-[11px] text-ink-on-dark-soft">other types</p></div>
              <div><p className="font-display text-[22px] font-bold">{FT_CARD_POINTS.broad}</p><p className="text-[11px] text-ink-on-dark-soft">Friend, Group</p></div>
            </div>
          </Panel>
          <Bullets items={[
            <>Friend and Group cards score {FT_CARD_POINTS.broad} anywhere and count as <strong>any type</strong>, so they fill a Rainbow or a Full team.</>,
            <>A card’s stars in this scenario make it stronger: +{Math.round(FT_STRENGTH_PER_STAR * 100)}% per star.</>,
            <>Each card has one <strong>trait</strong>, from its strongest effect in the original data:</>,
          ]} />
          <div className="grid gap-1">
            {CARD_EFFECTS.map((effect) => (
              <p key={effect} className="rounded-sm bg-white/5 px-2.5 py-1.5 text-[12px]"><span className="font-semibold text-accent">{FT_TRAITS[effect].name}:</span> {FT_TRAITS[effect].rule}.</p>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'main',
      title: 'Bond with your main card',
      body: (
        <>
          <Panel>
            <div className="flex items-center justify-around">
              <div className="grid justify-items-center gap-1"><Hearts filled={1} /><span className="text-[11px] text-ink-on-dark-soft">1 train together</span></div>
              <div className="grid justify-items-center gap-1"><Hearts filled={3} bonded /><span className="text-[11px] font-semibold text-accent">Bonded</span></div>
            </div>
          </Panel>
          <Bullets items={[
            <>The card you are training is <strong>always in your opening hand</strong>.</>,
            <>Every train it joins fills a heart. After {FT_BOND_GAUGE} it <strong>bonds</strong> for the rest of the run, just like rainbow training in the original.</>,
            <>A bonded card counts as <strong>on-type everywhere</strong>, and its <strong>signature</strong> switches on: its unique effect as extra traits at ×{FT_SIGNATURE_MULT}.</>,
            <>Bond early. Everything after is easier.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'races',
      title: 'Races',
      body: (
        <>
          <Panel>
            <div className="flex items-center gap-2">
              <RaceIcon size={20} className="text-accent" />
              <span className="flex-1 text-[14px] font-semibold">A mile on turf</span>
              {ftFavouredTypes('mile', 'turf').map((stat) => <TypeBadge key={stat} type={stat} />)}
              <span className="rounded-xs bg-accent px-1.5 text-[11px] font-bold text-ink">G3</span>
            </div>
            <p className="mt-1 text-[12px]"><span className="font-semibold text-accent">{FT_RIVAL_RULES['front-runner'].name}:</span> <span className="text-ink-on-dark-soft">{FT_RIVAL_RULES['front-runner'].rule}</span></p>
          </Panel>
          <Bullets items={[
            <>A race gives you {FT_RACE_TRAINS} trains and no facility. The course <strong>favours two types</strong>, which count as on-type: sprints Speed and Power, miles Speed and Wit, medium Speed and Stamina, long Stamina and Guts. Dirt brings Power in.</>,
            <>Each race has one <strong>rival rule</strong>: {FT_RIVAL_RULE_IDS.map((id) => FT_RIVAL_RULES[id].name).join(', ')}.</>,
            <>A won race pays {FT_RACE_PAYOUT} fans and offers a <strong>skill</strong>. The last race wins the season.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'skills',
      title: 'Skills and the shop',
      body: (
        <>
          <Bullets items={[
            <>You can hold {FT_SKILL_SLOTS} skills. Each run rule comes from the skill’s real race effect, and <strong>gold</strong> skills are stronger than white ones. Tap a skill in the bar to read it.</>,
          ]} />
          <div className="grid grid-cols-2 gap-1">
            {SKILL_ORDER.map((rule) => (
              <p key={rule} className="rounded-sm bg-white/5 px-2 py-1.5 text-[11px] leading-snug">
                <span className="block font-semibold text-accent">{FT_SKILL_RULES[rule].name}</span>
                {FT_SKILL_RULES[rule].rule(FT_SKILL_RULES[rule].white, false, 'Power')}
              </p>
            ))}
          </div>
          <Bullets items={[
            <>After every race but the last, the <strong>shop</strong> opens. Prices, in fans: a card copy {FT_SHOP_PRICES.copy} · removing a card {FT_SHOP_PRICES.remove} · upgrading one (+5 points) {FT_SHOP_PRICES.upgrade} · a white skill {FT_SHOP_PRICES.white} · a gold skill {FT_SHOP_PRICES.gold} · a reroll {FT_SHOP_PRICES.reroll}.</>,
            <>Fans vanish when the run ends, so spend them.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'twists',
      title: 'Scenario twists',
      body: (
        <>
          <p className="text-[14px] leading-snug">Each scenario adds one rule of its own, the same theme as its constellation buff.</p>
          <div className="grid gap-1">
            {FT_TWISTS.map((twist, index) => {
              const current = index + 1 === tier
              return (
                <p key={twist.id} className={`rounded-sm px-2.5 py-1.5 text-[12px] leading-snug ${current ? 'border border-accent bg-accent/15' : 'bg-white/5'}`}>
                  <span className="font-semibold text-accent">{scenarioForTier(index + 1)?.name} · {twist.name}:</span> {twist.rule}
                  {current && <span className="ml-1 text-[10px] font-bold text-accent uppercase">this run</span>}
                </p>
              )
            })}
          </div>
        </>
      ),
    },
    {
      id: 'tips',
      title: 'Tips',
      body: (
        <Bullets items={[
          <>Build <strong>Rainbows</strong>: three or more of the facility’s type is where the big scores are.</>,
          <><strong>Redraw</strong> off-type cards before you train, not after.</>,
          <>Put your main card in your first trains to bond it early.</>,
          <>Friend and Group cards fit anywhere: keep one in hand for a Rainbow or a Full team.</>,
          <>Clear with trains to spare: each unused one pays {FT_UNUSED_TRAIN_FANS} fans for the shop.</>,
          <>Read the rival rule before your first race train. <strong>Give up</strong>, in the menu at the top right, ends the run as a loss.</>,
        ]} />
      ),
    },
  ]
}

/**
 * The guide: one page at a time, Back and Next, swipe on touch. Opened from the start screen, by itself on a device's
 * first visit, and from the run's menu at the page that fits the moment.
 */
export function FtGuide({ open, tier, startAt = 'goal', onClose }: { open: boolean; tier: number; startAt?: GuidePageId; onClose: () => void }) {
  return (
    <PagedGuide
      open={open}
      pages={pages(tier)}
      startAt={startAt}
      titleId="ft-guide-title"
      finishLabel="Let’s train"
      onClose={onClose}
    />
  )
}
