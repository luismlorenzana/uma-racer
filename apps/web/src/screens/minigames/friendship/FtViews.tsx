import {
  FT_FORMATIONS,
  FT_MAX_REDRAW,
  FT_MAX_TRAIN,
  FT_RIVAL_RULES,
  FT_SHOP_PRICES,
  FT_SKILL_RULES,
  FT_SKILL_SLOTS,
  FT_STRENGTH_PER_STAR,
  FT_TRAITS,
  FT_TWISTS,
  MAX_STARS,
  STATS,
  ftFinished,
  ftScoreTrain,
  ftSkillValue,
  type FtAction,
  type FtCardDef,
  type FtSetup,
  type FtShopItem,
  type FtSkillDef,
  type FtState,
  type StatKey,
} from '@racer/domain'
import { useMemo, useState } from 'react'
import type { LoadedContent } from '../../../content/runtime'
import { BottomSheet } from '../../../ui/BottomSheet'
import { Button } from '../../../ui/Button'
import { CheckIcon, RaceIcon } from '../../../ui/icons'
import { CountUp } from '../../../ui/CountUp'
import { Stars } from '../../../ui/Stars'
import { FtCard, STAT_NAMES, TypeBadge, typeName } from './FtCard'
import { TypeIcon } from '../../../ui/TypeIcon'
import { FtScene } from './FtScene'

export interface ViewProps {
  content: LoadedContent
  setup: FtSetup
  state: FtState
  art: ReadonlyMap<string, string>
  act: (action: FtAction) => void
  busy: boolean
}

const round = (value: number) => Math.round(value)
const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1)

export function skillRuleText(skill: FtSkillDef): string {
  const rule = FT_SKILL_RULES[skill.rule]
  return rule.rule(ftSkillValue(skill.rule, skill.gold), skill.gold, skill.stat ? STAT_NAMES[skill.stat] : undefined)
}

/** What a scenario's twist has banked so far, as short chips. */
function twistChips(setup: FtSetup, state: FtState): string[] {
  const twist = state.twist
  const encounter = state.encounter
  switch (setup.twist) {
    case 'climax': return twist.racesWon > 0 ? [`Climax +${twist.racesWon} mult`] : []
    case 'performance': return [twist.performanceReady ? 'Performance ready · × 2' : `Notes ${twist.notes.length}/5`]
    case 'fragments': return [twist.fragmentsReady ? 'Fragments ready · × 1.5' : `Fragments ${twist.fragments}/8`]
    case 'expedition': return twist.expedition.map((stat) => `${STAT_NAMES[stat]} on-type`)
    case 'cooking': return twist.dishTrains > 0 ? [`Dish × 1.2 · ${twist.dishTrains} left`] : []
    case 'research': return encounter?.facility && twist.research[encounter.facility] > 0 ? [`Research Lv ${twist.research[encounter.facility]}`] : []
    case 'construction': return twist.built.length > 0 ? [`Built: ${twist.built.map((stat) => STAT_NAMES[stat]).join(', ')}`] : []
    case 'orders': return encounter?.order ? [`Order: ${FT_FORMATIONS[encounter.order].name} · ${encounter.orderFilled ? 'filled' : '3 fans'}`] : []
    default: return []
  }
}

// ── Skills ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function SkillRow({ skill, selected, onClick }: { skill: FtSkillDef; selected?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className={`rounded-xs px-1.5 text-[10px] font-bold uppercase ${skill.gold ? 'bg-accent text-ink' : 'bg-white/15 text-ink-on-dark'}`}>{skill.gold ? 'Gold' : 'White'}</span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{skill.name}</span>
        {selected && <CheckIcon size={20} className="text-accent" />}
      </span>
      <span className="mt-1 block text-[13px] text-ink-on-dark">{FT_SKILL_RULES[skill.rule].name}: {skillRuleText(skill)}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-ink-on-dark-soft">On track: {skill.description}</span>
    </>
  )
  const frame = `block w-full rounded-md border p-3 text-left ${skill.gold ? 'border-accent/70' : 'border-hairline-dark'} ${selected ? 'bg-white/10' : 'bg-stage-soft'}`
  return onClick ? <button type="button" onClick={onClick} className={frame}>{body}</button> : <div className={frame}>{body}</div>
}

/** The five skill slots under the header; tapping one explains it. */
export function SkillBar({ setup, state }: { setup: FtSetup; state: FtState }) {
  const [open, setOpen] = useState<FtSkillDef | null>(null)
  return (
    <>
      <div className="flex gap-1" aria-label="Skills">
        {Array.from({ length: FT_SKILL_SLOTS }, (_, index) => {
          const skill = state.skills[index] ? setup.skills[state.skills[index]!] : undefined
          return skill ? (
            <button
              key={index}
              type="button"
              onClick={() => setOpen(skill)}
              className={`min-h-9 min-w-0 flex-1 truncate rounded-xs border px-1.5 text-[11px] font-semibold ${skill.gold ? 'border-accent bg-accent/20 text-ink-on-dark' : 'border-hairline-dark bg-stage-soft text-ink-on-dark'}`}
            >
              {skill.name}
            </button>
          ) : (
            <span key={index} className="min-h-9 flex-1 rounded-xs border border-dashed border-hairline-dark" aria-label="Empty skill slot" />
          )
        })}
      </div>
      <BottomSheet open={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <div className="grid gap-2 pb-2">
            <p className="text-micro text-ink-soft">{open.gold ? 'Gold skill' : 'White skill'} · {FT_SKILL_RULES[open.rule].name}</p>
            <h2 className="text-xl font-semibold">{open.name}</h2>
            <p className="text-[15px]">{skillRuleText(open)}</p>
            <p className="text-[13px] text-ink-soft">On track: {open.description}</p>
          </div>
        )}
      </BottomSheet>
    </>
  )
}

// ── Card sheet and deck ─────────────────────────────────────────────────────────────────────────────────────────────

export function CardSheet({ setup, def, points, onClose }: { setup: FtSetup; def: FtCardDef | null; points?: number; onClose: () => void }) {
  const main = def?.id === setup.mainCardId
  return (
    <BottomSheet open={def !== null} onClose={onClose}>
      {def && (
        <div className="grid gap-2 pb-2">
          <div className="flex items-center gap-2">
            <TypeBadge type={def.type} size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{def.name}</h2>
              <p className="truncate text-[12px] text-ink-soft">{def.title} · {typeName(def.type)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[13px]">
            <Stars value={setup.legendsCardId === def.id ? MAX_STARS : def.stars} />
            <span className="text-ink-soft">{setup.legendsCardId === def.id ? `Legends: plays as ${MAX_STARS}★` : `strength × ${(1 + FT_STRENGTH_PER_STAR * def.stars).toFixed(2)}`}</span>
          </div>
          {points !== undefined && <p className="text-[13px]">Scores <strong>{points}</strong> points here.</p>}
          <p className="text-[14px]"><strong>{FT_TRAITS[def.trait].name}:</strong> {FT_TRAITS[def.trait].rule}.</p>
          {main && (
            <p className="text-[13px] text-ink-soft">
              Signature once bonded (× 1.5): {def.signature.map((kind) => `${FT_TRAITS[kind].name} — ${FT_TRAITS[kind].rule}`).join('; ')}.
            </p>
          )}
          {(def.type === 'friend' || def.type === 'group') && <p className="text-[13px] text-ink-soft">Friend and Group cards count as any type and score 7 anywhere.</p>}
        </div>
      )}
    </BottomSheet>
  )
}

/** The deck, grouped by card; with `onPick`, a card is chosen from it (shop removal and upgrades). */
export function DeckSheet({ content, setup, state, art, open, title, onPick, onClose }: {
  content: LoadedContent
  setup: FtSetup
  state: FtState
  art: ReadonlyMap<string, string>
  open: boolean
  title: string
  onPick?: (uid: number) => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="mb-2 text-[12px] text-ink-soft">{state.deck.length} cards{onPick ? ' · tap one' : ''}</p>
      <div className="grid grid-cols-4 gap-2 pb-2">
        {state.deck.map((instance) => {
          const def = setup.cards[instance.cardId]!
          return (
            <div key={instance.uid} className="grid gap-0.5">
              <FtCard
                content={content}
                def={def}
                art={art.get(def.id) ?? null}
                onSelect={onPick ? () => onPick(instance.uid) : undefined}
                corner={instance.bonus > 0 ? <span className="absolute bottom-1 left-1 rounded-xs bg-accent px-1 text-[10px] font-bold text-ink">+{instance.bonus}</span> : undefined}
              />
              <span className="truncate text-center text-[10px] text-ink-soft">{def.name}</span>
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}

// ── Build and facility ──────────────────────────────────────────────────────────────────────────────────────────────

export function BuildView({ act, busy }: ViewProps) {
  const [picked, setPicked] = useState<StatKey[]>([])
  const toggle = (stat: StatKey) => setPicked((current) => current.includes(stat) ? current.filter((entry) => entry !== stat) : current.length < 2 ? [...current, stat] : current)
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold">Build two facilities</h2>
        <p className="text-[13px] text-ink-on-dark-soft">Construction: they pay +5 points per card for the rest of the run.</p>
      </div>
      <div className="grid gap-2">
        {STATS.map((stat) => {
          const on = picked.includes(stat)
          return (
            <button key={stat} type="button" aria-pressed={on} onClick={() => toggle(stat)}
              className={`flex min-h-12 items-center gap-3 rounded-md border px-3 ${on ? 'border-accent bg-white/10' : 'border-hairline-dark bg-stage-soft'}`}>
              <TypeIcon type={stat} size={32} />
              <span className="flex-1 text-left font-semibold">{STAT_NAMES[stat]}</span>
              {on && <CheckIcon size={20} className="text-accent" />}
            </button>
          )
        })}
      </div>
      <div className="mt-auto">
        <Button className="w-full" disabled={picked.length !== 2 || busy} onClick={() => act({ type: 'build', facilities: picked })}>Build</Button>
      </div>
    </div>
  )
}

export function FacilityView(props: ViewProps) {
  const { setup, state, act, busy } = props
  const onType = (stat: StatKey) => state.deck.filter(({ cardId }) => {
    const type = setup.cards[cardId]!.type
    return type === stat || type === 'friend' || type === 'group' || (cardId === setup.mainCardId && state.bonded)
  }).length
  const grades = ['Easy', 'Standard', 'Hard']
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div>
        <p className="text-micro text-ink-on-dark-soft">Week {state.week + 1} of stage {state.stage + 1}</p>
        <h2 className="text-xl font-semibold">Choose a facility</h2>
        <p className="text-[13px] text-ink-on-dark-soft">Cards of its type score 10, others 5. Three on-type cards make a Rainbow.</p>
      </div>
      <div className="grid gap-2">
        {state.facilityOffers!.map((offer, index) => {
          return (
            <button key={offer.type} type="button" disabled={busy} onClick={() => act({ type: 'facility', index })}
              className="flex min-h-18 items-center gap-3 rounded-md border border-hairline-dark bg-stage-soft px-3 py-2 text-left active:bg-white/10">
              <TypeIcon type={offer.type} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">{STAT_NAMES[offer.type]} <span className="text-[11px] font-semibold text-ink-on-dark-soft uppercase">{grades[index]}</span></span>
                <span className="block text-[12px] text-ink-on-dark-soft">{onType(offer.type)} of your {state.deck.length} cards on-type</span>
              </span>
              <span className="text-right">
                <span className="font-display block text-[20px] font-bold tabular-nums">{offer.target}</span>
                <span className="block text-[11px] font-semibold text-accent">+{offer.payout} fans</span>
              </span>
            </button>
          )
        })}
      </div>
      <FtScene content={props.content} setup={setup} state={state} place={{ kind: 'rest' }} compact />
      <p className="text-[12px] text-ink-on-dark-soft">Scenario twist · {FT_TWISTS.find((twist) => twist.id === setup.twist)!.name}: {FT_TWISTS.find((twist) => twist.id === setup.twist)!.rule}</p>
    </div>
  )
}

// ── Encounter ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function EncounterView({ content, setup, state, art, act, busy }: ViewProps) {
  const encounter = state.encounter!
  const [selected, setSelected] = useState<number[]>([])
  const [inspect, setInspect] = useState<{ def: FtCardDef; points: number } | null>(null)
  const handKey = encounter.hand.join(',')
  const [lastHand, setLastHand] = useState(handKey)
  if (lastHand !== handKey) {
    setLastHand(handKey)
    setSelected([])
  }
  const points = useMemo(() => new Map(encounter.hand.map((uid) => [uid, round(ftScoreTrain(setup, state, [uid]).cardPoints)])), [setup, state, encounter.hand])
  const preview = selected.length > 0 ? ftScoreTrain(setup, state, selected) : null
  const toggle = (uid: number) => setSelected((current) => current.includes(uid) ? current.filter((entry) => entry !== uid) : current.length < FT_MAX_TRAIN ? [...current, uid] : current)
  const race = encounter.kind === 'race'
  const raceDef = setup.races[state.stage]!
  const columns = Math.ceil(encounter.hand.length / 2)
  const progress = Math.min(1, encounter.score / encounter.target)
  const chips = twistChips(setup, state)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Score against the target, trains and redraws left. */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[22px] font-bold tabular-nums"><CountUp value={encounter.score} /><span className="text-[14px] text-ink-on-dark-soft"> / {encounter.target}</span></span>
          <span className="flex items-center gap-3 text-[12px] font-semibold">
            <span aria-label={`${encounter.trainsLeft} trains left`} className="flex items-center gap-1">
              Trains
              {Array.from({ length: encounter.trainsLeft + encounter.trainsUsed }, (_, index) => (
                <span key={index} className={`h-2.5 w-2.5 rounded-full ${index < encounter.trainsLeft ? 'bg-accent' : 'bg-white/20'}`} />
              ))}
            </span>
            <span>Redraws {encounter.redrawsLeft}</span>
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full origin-left rounded-full bg-accent transition-transform duration-300" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>

      {/* The scene, with the facility or the race and its rival rule on top. */}
      <FtScene content={content} setup={setup} state={state}
        place={race ? { kind: 'race', surface: raceDef.surface } : { kind: 'week', stat: encounter.facility! }}>
        <div className="rounded-md bg-stage/60 px-2.5 py-1.5 backdrop-blur-sm">
          {race ? (
            <>
              <div className="flex items-center gap-2">
                <RaceIcon size={20} className="text-accent" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{raceDef.name}</span>
                <span className="flex items-center gap-1" aria-label={`Favours ${encounter.favoured.map((stat) => STAT_NAMES[stat]).join(' and ')}`}>
                  {encounter.favoured.map((stat) => <TypeBadge key={stat} type={stat} />)}
                </span>
                <span className="rounded-xs bg-accent px-1.5 text-[11px] font-bold text-ink">{raceDef.grade.toUpperCase()}</span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-on-dark-soft">
                {raceDef.distance} m {raceDef.surface}
                {encounter.rival && <> · <span className="font-semibold text-accent">{FT_RIVAL_RULES[encounter.rival].name}:</span> {FT_RIVAL_RULES[encounter.rival].rule}</>}
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <TypeBadge type={encounter.facility!} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{STAT_NAMES[encounter.facility!]} training</span>
                <span className="block text-[12px] text-ink-on-dark-soft">Week {state.week + 1} · stage {state.stage + 1} · +{encounter.payout} fans</span>
              </span>
            </div>
          )}
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((chip) => <span key={chip} className="rounded-full bg-white/10 px-2 text-[11px] leading-5 font-semibold">{chip}</span>)}
            </div>
          )}
        </div>
      </FtScene>

      {/* The live readout. */}
      <div className="min-h-11 rounded-md bg-black/25 px-3 py-1.5" aria-live="polite">
        {preview ? (
          <p className="text-[14px]">
            <span className="font-semibold text-accent">{FT_FORMATIONS[preview.formation].name}</span>
            <span className="text-ink-on-dark-soft"> · ({round(preview.cardPoints + preview.bonusPoints + preview.formationPoints)}) × {fmt(preview.mult)}{preview.factor !== 1 ? ` × ${fmt(preview.factor)}` : ''} = </span>
            <span className="font-display font-bold">{preview.total}</span>
            {preview.notes.length > 0 && <span className="block text-[11px] text-ink-on-dark-soft">{preview.notes.join(' · ')}</span>}
          </p>
        ) : state.lastTrain ? (
          <p className="text-[13px] text-ink-on-dark-soft">Last train: {FT_FORMATIONS[state.lastTrain.formation].name} · {state.lastTrain.total}. Pick up to five cards.</p>
        ) : (
          <p className="text-[13px] text-ink-on-dark-soft">Pick up to five cards. Long-press a card to read it.</p>
        )}
      </div>

      {/* The hand: two rows of full-art cards in the thumb zone. */}
      {/* Two rows of 3:4 cards; on a short screen the hand narrows so the scene keeps its room (about 72 × 96 pt at 667). */}
      <div className="mx-auto grid w-full gap-2 pt-2"
        style={{ gridTemplateColumns: `repeat(${columns * 2}, minmax(0, 1fr))`, maxWidth: `calc((100dvh - 475px) * ${(columns * 0.375).toFixed(3)} + ${(columns - 1) * 8}px)` }}>
        {encounter.hand.map((uid, index) => {
          const instance = state.deck.find((entry) => entry.uid === uid)!
          const def = setup.cards[instance.cardId]!
          const main = instance.cardId === setup.mainCardId
          // Row two sits centred under row one when it is one card shorter.
          const offset = index === columns && encounter.hand.length % 2 === 1 ? 2 : 0
          return (
            <div key={uid} className="col-span-2" style={offset ? { gridColumnStart: offset } : undefined}>
              <FtCard
                content={content}
                def={def}
                art={art.get(def.id) ?? null}
                points={points.get(uid)}
                selected={selected.includes(uid)}
                gauge={main ? state.gauge : undefined}
                bonded={main && state.bonded}
                onSelect={() => toggle(uid)}
                onInspect={() => setInspect({ def, points: points.get(uid) ?? 0 })}
                corner={instance.bonus > 0 ? <span className="absolute bottom-1 left-1 rounded-xs bg-accent px-1 text-[10px] font-bold text-ink">+{instance.bonus}</span> : undefined}
              />
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <Button variant="secondary" disabled={busy || selected.length === 0 || selected.length > FT_MAX_REDRAW || encounter.redrawsLeft <= 0}
          onClick={() => act({ type: 'redraw', uids: selected })}>
          Redraw{selected.length > 0 ? ` ${selected.length}` : ''}
        </Button>
        <Button disabled={busy || selected.length === 0} onClick={() => act({ type: 'train', uids: selected })}>
          Train{preview ? ` · ${preview.total}` : ''}
        </Button>
      </div>
      <CardSheet setup={setup} def={inspect?.def ?? null} points={inspect?.points} onClose={() => setInspect(null)} />
    </div>
  )
}

// ── Reward, skill and shop ──────────────────────────────────────────────────────────────────────────────────────────

export function RewardView({ content, setup, state, art, act, busy }: ViewProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const [inspect, setInspect] = useState<FtCardDef | null>(null)
  const offer = state.rewardOffer ?? []
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div>
        <p className="text-micro text-accent">Week cleared · {state.fans} fans</p>
        <h2 className="text-xl font-semibold">Add a card to your deck</h2>
        <p className="text-[13px] text-ink-on-dark-soft">Pick one to add a copy, or skip. Long-press to read a card.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {offer.map((id) => {
          const def = setup.cards[id]!
          return (
            <div key={id} className="grid gap-1">
              <FtCard content={content} def={def} art={art.get(id) ?? null} selected={picked === id} onSelect={() => setPicked(picked === id ? null : id)} onInspect={() => setInspect(def)} />
              <span className="truncate text-center text-[12px] font-semibold">{def.name}</span>
              <span className="truncate text-center text-[11px] text-ink-on-dark-soft">{typeName(def.type)} · {FT_TRAITS[def.trait].name}</span>
            </div>
          )
        })}
      </div>
      <FtScene content={content} setup={setup} state={state} place={{ kind: 'rest' }} cheer compact />
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => act({ type: 'reward', cardId: null })}>Skip</Button>
        <Button disabled={busy || picked === null} onClick={() => act({ type: 'reward', cardId: picked })}>Add card</Button>
      </div>
      <CardSheet setup={setup} def={inspect} onClose={() => setInspect(null)} />
    </div>
  )
}

export function SkillView({ setup, state, act, busy }: ViewProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const [replace, setReplace] = useState<number | null>(null)
  const full = state.skills.length >= FT_SKILL_SLOTS
  const offer = state.skillOffer ?? []
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div>
        <p className="text-micro text-accent">Race won · {state.fans} fans</p>
        <h2 className="text-xl font-semibold">Choose a skill</h2>
        <p className="text-[13px] text-ink-on-dark-soft">{full ? 'Your five slots are full: pick a skill, then the one it replaces.' : 'Skills keep working for the rest of the run.'}</p>
      </div>
      <div className="grid gap-2">
        {offer.map((id) => <SkillRow key={id} skill={setup.skills[id]!} selected={picked === id} onClick={() => setPicked(picked === id ? null : id)} />)}
      </div>
      {full && picked && (
        <div className="grid gap-1">
          <p className="text-micro text-ink-on-dark-soft">Replace</p>
          {state.skills.map((id, index) => (
            <button key={id} type="button" aria-pressed={replace === index} onClick={() => setReplace(index)}
              className={`min-h-11 rounded-sm border px-3 text-left text-[13px] font-semibold ${replace === index ? 'border-accent bg-white/10' : 'border-hairline-dark bg-stage-soft'}`}>
              {setup.skills[id]!.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-auto grid grid-cols-[1fr_1.4fr] gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => act({ type: 'skill', skillId: null })}>Skip</Button>
        <Button disabled={busy || picked === null || (full && replace === null)}
          onClick={() => act({ type: 'skill', skillId: picked, ...(full && replace !== null ? { replace } : {}) })}>
          Take skill
        </Button>
      </div>
    </div>
  )
}

export function ShopView({ content, setup, state, art, act, busy }: ViewProps) {
  const shop = state.shop!
  const [picker, setPicker] = useState<'remove' | 'upgrade' | null>(null)
  const [skillBuy, setSkillBuy] = useState<'white' | 'gold' | null>(null)
  const full = state.skills.length >= FT_SKILL_SLOTS
  const can = (item: FtShopItem) => !busy && state.fans >= FT_SHOP_PRICES[item] && (item === 'reroll' || !shop.bought.includes(item))
  const buySkill = (item: 'white' | 'gold') => full ? setSkillBuy(item) : act({ type: 'buy', item })

  const row = (item: FtShopItem, title: string, detail: string, onBuy: () => void, available = true) => (
    <div className="flex min-h-14 items-center gap-3 rounded-md border border-hairline-dark bg-stage-soft px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="block text-[12px] text-ink-on-dark-soft">{detail}</span>
      </span>
      <Button size="sm" variant={shop.bought.includes(item) ? 'secondary' : 'primary'} disabled={!available || !can(item)} onClick={onBuy}>
        {shop.bought.includes(item) && item !== 'reroll' ? 'Bought' : `${FT_SHOP_PRICES[item]} fans`}
      </Button>
    </div>
  )
  const copy = shop.copy ? setup.cards[shop.copy] : undefined
  const white = shop.white ? setup.skills[shop.white] : undefined
  const gold = shop.gold ? setup.skills[shop.gold] : undefined

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div>
        <p className="text-micro text-accent">Shop · before stage {state.stage + 2}</p>
        <h2 className="text-xl font-semibold">{state.fans} fans to spend</h2>
        <p className="text-[13px] text-ink-on-dark-soft">Fans vanish when the run ends.</p>
      </div>
      {copy && (
        <div className="flex items-center gap-3 rounded-md border border-hairline-dark bg-stage-soft px-3 py-2">
          <span className="w-12 shrink-0"><FtCard content={content} def={copy} art={art.get(copy.id) ?? null} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">A copy of {copy.name}</span>
            <span className="block text-[12px] text-ink-on-dark-soft">{typeName(copy.type)} · {FT_TRAITS[copy.trait].name}</span>
          </span>
          <Button size="sm" disabled={!can('copy')} onClick={() => act({ type: 'buy', item: 'copy' })}>
            {shop.bought.includes('copy') ? 'Bought' : `${FT_SHOP_PRICES.copy} fans`}
          </Button>
        </div>
      )}
      {row('remove', 'Remove a card', 'Thin the deck: one copy leaves it.', () => setPicker('remove'))}
      {row('upgrade', 'Upgrade a card', 'One copy scores +5 points for the rest of the run.', () => setPicker('upgrade'))}
      {white && row('white', white.name, `White · ${skillRuleText(white)}`, () => buySkill('white'))}
      {gold && row('gold', gold.name, `Gold · ${skillRuleText(gold)}`, () => buySkill('gold'))}
      {row('reroll', 'Reroll', 'New card and skills on the shelf.', () => act({ type: 'buy', item: 'reroll' }))}
      {/* Pinned to the bottom of the scrolling shop, so Next stage is always in reach. */}
      <div className="sticky bottom-0 mt-auto bg-stage pt-2">
        <Button className="w-full" disabled={busy} onClick={() => act({ type: 'leave-shop' })}>Next stage</Button>
      </div>
      <DeckSheet content={content} setup={setup} state={state} art={art} open={picker !== null}
        title={picker === 'remove' ? 'Remove which card?' : 'Upgrade which card?'}
        onPick={(uid) => { act({ type: 'buy', item: picker!, uid }); setPicker(null) }} onClose={() => setPicker(null)} />
      <BottomSheet open={skillBuy !== null} onClose={() => setSkillBuy(null)}>
        <h2 className="mb-2 text-lg font-semibold">Replace which skill?</h2>
        <div className="grid gap-1 pb-2">
          {state.skills.map((id, index) => (
            <button key={id} type="button" onClick={() => { act({ type: 'buy', item: skillBuy!, replace: index }); setSkillBuy(null) }}
              className="min-h-11 rounded-sm border border-hairline bg-panel px-3 text-left text-[14px] font-semibold">
              {setup.skills[id]!.name}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}

/** The run's header numbers: where it is and what it has. */
export function runProgress(setup: FtSetup, state: FtState): string {
  if (ftFinished(state)) return state.phase === 'won' ? 'Cleared' : 'Run over'
  const where = state.week >= 2 ? 'Race' : `Week ${state.week + 1}`
  return `Stage ${state.stage + 1}/${setup.races.length} · ${where}`
}

