import {
  STATS,
  autoTrainingDeck,
  scenarioForTier,
  type SupportCardType,
  type TrainingCardInput,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { setUmaDeck } from '../game/actions'
import { buildDeckView, deckEffectRows, formatDeckEffect, type DeckEraFilter, type DeckTypeFilter } from '../game/deck-view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const TYPES: readonly DeckTypeFilter[] = ['all', 'speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']
const TYPE_LABEL: Record<SupportCardType, string> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', friend: 'Friend', group: 'Group',
}
const EFFECT_LABEL = {
  trainingBonus: 'Training', friendshipBonus: 'Friendship', statBonus: 'Stat', skillPointBonus: 'Skill Points',
  specialtyPriority: 'Specialty', hintFrequency: 'Hints', raceBonus: 'Race Bonus', initialStats: 'Initial Stats',
} as const

export function DeckEditorScreen() {
  const { umaId = '' } = useParams()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const uma = useGame((state) => state.umas[umaId])
  const cards = useGame((state) => state.cards)
  const pushToast = useGame((state) => state.pushToast)
  const [draft, setDraft] = useState<string[] | null>(null)
  const [type, setType] = useState<DeckTypeFilter>('all')
  const [era, setEra] = useState<DeckEraFilter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ids = draft ?? uma?.deckCardIds ?? []
  const model = useMemo(() => contentState.status === 'ready' && uma
    ? buildDeckView(uma, cards, contentState.content, ids, { type, era })
    : null, [cards, contentState, era, ids, type, uma])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to edit decks" detail="Support decks are part of your private save." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before editing support decks." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready') return <ScreenState title="Opening deck…" detail="Loading owned cards and current content." />
  if (!uma || !model) return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />
  const umaTemplate = contentState.content.umas.byId.get(uma.templateId)
  if (!umaTemplate) return <ScreenState title="Content reference missing" detail={`The save is preserving ${uma.templateId} until its template is restored.`} action={{ label: 'Back to Stable', to: '/stable' }} />

  const setIds = (next: string[]) => { setDraft(next); setError(null) }
  const remove = (index: number) => setIds(ids.filter((_, itemIndex) => itemIndex !== index))
  const move = (index: number, offset: -1 | 1) => {
    const destination = index + offset
    if (destination < 0 || destination >= ids.length) return
    const next = [...ids]
    ;[next[index], next[destination]] = [next[destination]!, next[index]!]
    setIds(next)
  }
  const autoFill = () => {
    const owned = Object.values(cards).flatMap((save): TrainingCardInput[] => {
      const template = contentState.content.cards.byId.get(save.templateId)
      return template ? [{ save, template }] : []
    })
    const next = autoTrainingDeck(umaTemplate, model.tier, owned)
    if (next.length === 0) {
      setError('No owned cards are eligible for this scenario')
      return
    }
    setIds(next)
  }
  const save = () => {
    if (busy) return
    if (ids.length === 0) {
      setError('Equip at least one support card')
      return
    }
    if (model.validationErrors.length > 0) {
      setError(model.validationErrors[0]!)
      return
    }
    setBusy(true)
    setError(null)
    void setUmaDeck(uma.templateId, ids)
      .then(() => {
        pushToast('Support deck saved')
        navigate(`/stable/${encodeURIComponent(uma.templateId)}`)
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not save this deck'))
      .finally(() => setBusy(false))
  }
  const effectRows = deckEffectRows(model)

  return (
    <div className="flex flex-col gap-4 pt-2 pb-8">
      <Link to={`/stable/${encodeURIComponent(uma.templateId)}`} className="flex min-h-11 items-center gap-1 px-1 font-extrabold text-white text-outline">← {umaTemplate.name}</Link>

      <Panel className="bg-gradient-to-br from-violet-50 to-white">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-extrabold tracking-wide text-violet-700 uppercase">Tier {model.tier} · {scenarioForTier(model.tier)?.name ?? 'Future scenario'}</p><h1 className="text-2xl font-extrabold">Support Deck</h1></div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-extrabold text-violet-700">{ids.length} / {model.slotCount}</span>
        </div>
        <p className="mt-2 text-sm font-bold text-ink-soft">Order drives deterministic Training placement ties. Empty decks cannot be saved.</p>
        {!persistent && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-extrabold">Memory only — this edit lasts for this session.</p>}
      </Panel>

      <section aria-label="Deck slots" className="grid gap-2">
        {model.slots.map((slot) => {
          const selectedId = ids[slot.index]
          return (
            <div key={slot.index} className={`flex min-h-20 items-center gap-2 rounded-2xl border-2 p-2 ${slot.unlocked ? 'border-white bg-white/95' : 'border-slate-200 bg-slate-100/80 text-ink-soft'}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky/10 text-sm font-extrabold">{slot.index + 1}</span>
              {!slot.unlocked ? <p className="font-extrabold">Locked until a later scenario</p> : slot.card ? <>
                <AtlasSprite asset={slot.card.asset} decorative className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" fallback={<div className="flex h-full items-center justify-center text-lg">?</div>} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{slot.card.template ? `${slot.card.template.charName} · ${slot.card.template.title}` : `Missing ${slot.card.id}`}</p><p className="text-xs font-bold text-ink-soft">{slot.card.template && slot.card.save ? `${TYPE_LABEL[slot.card.template.type]} · Lv ${slot.card.save.level} · LB${slot.card.save.limitBreak} · Tier ${slot.card.template.era}` : slot.card.template ? 'Not owned · repair required' : 'Missing content · repair required'}</p></div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Move ${selectedId} earlier`} disabled={slot.index === 0 || busy} onClick={() => move(slot.index, -1)} className="min-h-11 min-w-11 rounded-xl bg-sky-50 font-extrabold disabled:opacity-35">↑</button>
                  <button type="button" aria-label={`Move ${selectedId} later`} disabled={slot.index === ids.length - 1 || busy} onClick={() => move(slot.index, 1)} className="min-h-11 min-w-11 rounded-xl bg-sky-50 font-extrabold disabled:opacity-35">↓</button>
                  <button type="button" aria-label={`Remove ${selectedId}`} disabled={busy} onClick={() => remove(slot.index)} className="min-h-11 min-w-11 rounded-xl bg-red-50 font-extrabold text-danger disabled:opacity-35">×</button>
                </div>
              </> : <p className="font-bold text-ink-soft">Empty slot · choose an owned card below</p>}
            </div>
          )
        })}
      </section>

      <Panel>
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Deck effects</h2><span className="text-sm font-extrabold text-sky-deep">Race Bonus {formatDeckEffect('raceBonus', model.raceBonus)}</span></div>
        <p className="mt-1 text-xs font-bold text-ink-soft">{model.hintSkillCount} unique hint skill{model.hintSkillCount === 1 ? '' : 's'}</p>
        {effectRows.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{effectRows.map((row) => <span key={row.effect} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-extrabold">{EFFECT_LABEL[row.effect]} {formatDeckEffect(row.effect, row.value)}</span>)}</div> : <p className="mt-3 text-sm text-ink-soft">Choose cards to preview their generated effects.</p>}
        {model.needsRepair && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm font-bold text-danger">Saved deck references need repair before Training or racing.</p>}
      </Panel>

      <div className="grid grid-cols-2 gap-2">
        <GameButton variant="secondary" disabled={busy} onClick={autoFill}>Auto fill</GameButton>
        <GameButton variant="go" disabled={busy || ids.length === 0 || model.validationErrors.length > 0} onClick={save}>{busy ? 'Saving…' : 'Save deck'}</GameButton>
      </div>
      {error && <m.p role="alert" initial={reducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">{error}</m.p>}
      {model.validationErrors.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{model.validationErrors.map((message) => <p key={message}>{message}</p>)}</div>}

      <section>
        <h2 className="text-lg font-extrabold text-white text-outline">Owned cards</h2>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((value) => <button key={value} type="button" onClick={() => setType(value)} className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-extrabold ${type === value ? 'bg-violet-600 text-white' : 'bg-white'}`}>{value === 'all' ? 'All types' : TYPE_LABEL[value]}</button>)}
        </div>
        <div className="mt-2 flex gap-2">
          {(['all', 'current', 'later'] as const).map((value) => <button key={value} type="button" onClick={() => setEra(value)} className={`min-h-11 rounded-full px-4 text-xs font-extrabold ${era === value ? 'bg-sky-deep text-white' : 'bg-white'}`}>{value === 'all' ? 'All eras' : value === 'current' ? 'Eligible now' : 'Later'}</button>)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {model.candidates.map((candidate) => (
            <button key={candidate.id} type="button" disabled={busy || candidate.disabledReason !== null} onClick={() => setIds([...ids, candidate.id])} className="min-h-24 overflow-hidden rounded-2xl border-2 border-white bg-white text-left shadow-sm [content-visibility:auto] disabled:opacity-55">
              <div className="flex gap-2 p-2">
                <AtlasSprite asset={candidate.asset} decorative className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" fallback={<div className="flex h-full items-center justify-center">?</div>} />
                <div className="min-w-0"><p className="line-clamp-2 text-xs font-extrabold">{candidate.template ? `${candidate.template.charName} · ${candidate.template.title}` : candidate.id}</p><p className="mt-1 text-[10px] font-bold text-ink-soft">{candidate.template ? `${TYPE_LABEL[candidate.template.type]} · Lv ${candidate.save.level} · LB${candidate.save.limitBreak}` : 'Missing content'}</p></div>
              </div>
              <p className={`min-h-8 px-2 pb-2 text-[10px] font-extrabold ${candidate.disabledReason ? 'text-ink-soft' : 'text-turf-deep'}`}>{candidate.disabledReason ?? '+ Add to deck'}</p>
            </button>
          ))}
        </div>
        {model.candidates.length === 0 && <Panel className="mt-3 text-center text-sm font-bold text-ink-soft">No owned cards match these filters.</Panel>}
      </section>
    </div>
  )
}
