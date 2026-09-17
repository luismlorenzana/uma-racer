import {
  STRATEGIES,
  SCENARIOS,
  compileRaceSkill,
  equippedRaceBonus,
  fieldForm,
  isGateLevel,
  raceExp,
  progressionFieldSize,
  raceSkillCompatibleWithCourse,
  raceSkillSupported,
  summarizeSkillLoadout,
  supportDeckIssueMessage,
  tierOfLevel,
  validateSupportDeck,
  yourForm,
  type RaceGrade,
  type RaceResultRecord,
  type RaceTemplate,
  type Strategy,
  type UmaSave,
} from '@racer/domain'
import { m } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { listRaceHistory, prepareRace, setUmaLoadout } from '../game/actions'
import type { PreparedRace } from '../game/racing'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { GRADE_LABEL, GRADE_STYLE, STRATEGY_LABEL } from './race/labels'

const GRADE_ORDER: Record<RaceGrade, number> = { g1: 0, g2: 1, g3: 2, op: 3, 'pre-op': 4, maiden: 5, debut: 6 }

const ordinal = (value: number) => {
  const suffix = ['th', 'st', 'nd', 'rd']
  const mod = value % 100
  return `${value}${suffix[(mod - 20) % 10] ?? suffix[mod] ?? 'th'}`
}

function raceLockReason(save: UmaSave, race: RaceTemplate, opponentCharacters: number): string | null {
  if (save.trainingsThisScenario < 1) return 'Complete one Training turn with this Uma first.'
  if (isGateLevel(save.level)) return 'This Uma is ready to promote and cannot race again yet.'
  const fieldSize = progressionFieldSize(race)
  if (opponentCharacters < fieldSize - 1) return `This field needs ${fieldSize - 1} distinct opponents.`
  return null
}

export function RaceSelectScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const saveError = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const persistent = useGame((state) => state.persistent)
  const [picked, setPicked] = useState<RaceTemplate | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('pace')
  const [history, setHistory] = useState<RaceResultRecord[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreparedRace | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [savingSkillId, setSavingSkillId] = useState<string | null>(null)

  const ownedIds = useMemo(() => Object.keys(owned).sort((left, right) => left.localeCompare(right)), [owned])
  const requestedUma = params.get('uma')
  const selectedUmaId = requestedUma && owned[requestedUma]
    ? requestedUma
    : profile?.featuredUmaId && owned[profile.featuredUmaId]
      ? profile.featuredUmaId
      : ownedIds[0] ?? null
  const selectedUma = selectedUmaId ? owned[selectedUmaId] : undefined
  const loadoutKey = selectedUma?.loadoutSkillIds.join('|') ?? ''

  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    void listRaceHistory(20).then((records) => {
      if (!cancelled) {
        setHistory(records)
        setHistoryError(null)
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setHistoryError(reason instanceof Error ? reason.message : 'Could not read race history')
    })
    return () => { cancelled = true }
  }, [profile?.tickets, profile?.umaShards, status])

  useEffect(() => {
    if (contentState.status !== 'ready' || status !== 'ready' || !picked || !selectedUmaId) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreview(null)
    setPreviewError(null)
    void prepareRace(selectedUmaId, picked.id, strategy).then((preparation) => {
      if (cancelled) return
      if (preparation.status === 'prepared') setPreview(preparation.attempt)
      else setPreviewError('The next race attempt was already completed.')
    }).catch((reason: unknown) => {
      if (!cancelled) setPreviewError(reason instanceof Error ? reason.message : 'Could not build field preview')
    })
    return () => { cancelled = true }
  }, [contentState, loadoutKey, picked, selectedUmaId, status, strategy])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to race" detail="Progression races use your private Stable and content." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private race content before racing." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={saveError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Preparing races…" detail="Loading private content and your local save." />
  if (!selectedUma || !selectedUmaId) return <ScreenState title="No owned Uma" detail="Add an Uma to your Stable before entering a race." action={{ label: 'Open Stable', to: '/stable' }} />

  const content = contentState.content
  const umaTemplate = content.umas.byId.get(selectedUmaId)
  if (!umaTemplate) return <ScreenState title="Content reference missing" detail={`The save is preserving ${selectedUmaId} until its template is restored.`} />
  const sortedRaces = [...content.races.items].sort((left, right) =>
    GRADE_ORDER[left.grade] - GRADE_ORDER[right.grade] ||
    left.distance - right.distance ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id),
  )
  const opponentCharacters = new Set(content.umas.items.filter((item) => item.charaId !== umaTemplate.charaId).map((item) => item.charaId)).size
  const selectedAsset = (() => {
    const frame = content.atlases['uma-icons'].descriptor.frames[selectedUmaId]
    if (!frame) return null
    const page = content.atlases['uma-icons'].descriptor.pages[frame.page]
    const url = content.atlases['uma-icons'].pageUrls[frame.page]
    return page && url ? { url, frame, pageWidth: page.width, pageHeight: page.height } : null
  })()
  let raceBonus = 0
  let deckError: string | null = null
  try {
    const deck = validateSupportDeck({
      tier: tierOfLevel(selectedUma.level),
      orderedCardIds: selectedUma.deckCardIds,
      ownedCards: Object.values(cards),
      templates: content.cards.byId,
    })
    const issue = deck.issues[0]
    if (issue) throw new Error(supportDeckIssueMessage(issue))
    raceBonus = equippedRaceBonus(tierOfLevel(selectedUma.level), deck.cards)
  } catch (reason) {
    deckError = reason instanceof Error ? reason.message : 'Race deck is invalid'
  }
  const skillLoadout = summarizeSkillLoadout(selectedUma, umaTemplate, content.skills.byId)
  const promotionRequired = isGateLevel(selectedUma.level) && selectedUma.level < SCENARIOS.length * 10
  const lockReason = picked
    ? raceLockReason(selectedUma, picked, opponentCharacters) ?? deckError ?? (skillLoadout.valid ? null : skillLoadout.errors[0]!)
    : null

  const chooseUma = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('uma', id)
    setParams(next, { replace: true })
    setStartError(null)
  }

  const start = async () => {
    if (!picked || lockReason || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const preparation = await prepareRace(selectedUmaId, picked.id, strategy)
      if (preparation.status !== 'prepared') throw new Error('The next race attempt was already completed')
      navigate(`/race/run?uma=${encodeURIComponent(selectedUmaId)}&race=${encodeURIComponent(picked.id)}&strategy=${strategy}&sequence=${preparation.attempt.sequence}`)
    } catch (reason) {
      setStartError(reason instanceof Error ? reason.message : 'Could not prepare race')
      setStarting(false)
    }
  }

  const toggleSkill = async (skillId: string) => {
    if (savingSkillId) return
    const next = selectedUma.loadoutSkillIds.includes(skillId)
      ? selectedUma.loadoutSkillIds.filter((id) => id !== skillId)
      : [...selectedUma.loadoutSkillIds, skillId]
    setSavingSkillId(skillId)
    setStartError(null)
    try {
      await setUmaLoadout(selectedUmaId, next)
    } catch (reason) {
      setStartError(reason instanceof Error ? reason.message : 'Could not update skill loadout')
    } finally {
      setSavingSkillId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-extrabold text-white text-outline">Choose a race</h1>
          <p className="text-sm font-bold text-ink-soft">{sortedRaces.length} races · no ticket cost</p>
        </div>
        <select
          aria-label="Racing Uma"
          value={selectedUmaId}
          onChange={(event) => chooseUma(event.target.value)}
          className="min-h-11 max-w-44 rounded-2xl border-2 border-white bg-white/95 px-3 text-sm font-extrabold"
        >
          {ownedIds.map((id) => <option key={id} value={id}>{content.umas.byId.get(id)?.name ?? id}</option>)}
        </select>
      </div>

      {!persistent && <Panel className="border-amber-300 bg-amber-50 py-3 text-sm font-bold">Memory only — race progress will not survive a reload or sync.</Panel>}
      {isGateLevel(selectedUma.level) && <Panel className="border-gold bg-amber-50 text-center">
        <p className="font-extrabold">{selectedUma.level >= SCENARIOS.length * 10 ? 'Latest scenario complete' : 'Promotion required'}</p>
        <p className="mt-1 text-sm text-ink-soft">{selectedUma.level >= SCENARIOS.length * 10 ? 'No later scenario is available yet.' : 'Start the next scenario before preparing another race.'}</p>
        {selectedUma.level < SCENARIOS.length * 10 && <GameButton className="mt-3" onClick={() => navigate(`/scenario/${encodeURIComponent(selectedUmaId)}/start`)}>Review promotion</GameButton>}
      </Panel>}

      {sortedRaces.map((race, index) => (
        <m.button
          key={race.id}
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index, 8) * 0.025 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setPicked(race); setStartError(null) }}
          className="flex min-h-18 items-center gap-3 rounded-[var(--radius-panel)] border-2 border-white bg-white/95 p-3 text-left shadow-[var(--shadow-panel)]"
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-sm font-extrabold text-white text-outline ${GRADE_STYLE[race.grade]}`}>
            {GRADE_LABEL[race.grade]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-extrabold">{race.name}</span>
            <span className="block text-sm text-ink-soft">{race.venue} · {race.surface === 'turf' ? 'Turf' : 'Dirt'} {race.distance}m · {progressionFieldSize(race)} runners</span>
            <span className="block text-xs font-bold text-sky-deep">Win EXP {raceExp(race.grade, 1, raceBonus)}</span>
          </span>
          <span className="text-2xl" aria-hidden>›</span>
        </m.button>
      ))}

      <Panel>
        <h2 className="font-extrabold">Recent results</h2>
        {historyError && <p className="mt-2 text-sm font-bold text-danger">{historyError}</p>}
        {!historyError && history.length === 0 && <p className="mt-2 text-sm text-ink-soft">No recorded races yet.</p>}
        <div className="mt-2 grid gap-2">
          {history.slice(0, 8).map((record) => (
            <div key={`${record.umaId}:${record.sequence}`} className="flex min-h-11 items-center gap-3 rounded-xl bg-sky-50 px-3 py-2 text-sm">
              <span className="w-10 font-extrabold">{ordinal(record.playerPlacement)}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{content.umas.byId.get(record.umaId)?.name ?? record.umaId} · {content.races.byId.get(record.raceId)?.name ?? record.raceId}</span>
              <span className="text-right text-xs font-extrabold text-sky-deep">+{record.expGained} EXP{record.ticketReward ? ` · +${record.ticketReward} 🎫` : ''}</span>
            </div>
          ))}
        </div>
      </Panel>

      <BottomSheet open={picked !== null} onClose={() => !starting && setPicked(null)}>
        {picked && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-extrabold tracking-wider text-ink-soft uppercase">{GRADE_LABEL[picked.grade]}</p>
              <p className="text-2xl font-extrabold">{picked.name}</p>
              <p className="text-sm text-ink-soft">{picked.venue} · {picked.surface === 'turf' ? 'Turf' : 'Dirt'} {picked.distance}m · {progressionFieldSize(picked)} runners</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-sky-50 p-3">
              <div className="w-16 shrink-0">
                <AtlasSprite asset={selectedAsset} alt={`${umaTemplate.name} icon`} className="rounded-xl bg-white" fallback={<div className="flex h-full items-center justify-center text-3xl">🐴</div>} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{umaTemplate.name} · Lv {selectedUma.level}</p>
                <p className="text-xs font-bold text-ink-soft">Form {Math.round(yourForm(selectedUma.level) * 100)}% vs field {Math.round(fieldForm(selectedUma.level) * 100)}%</p>
                <p className="text-xs font-bold text-sky-deep">Race Bonus +{Math.round(raceBonus * 100)}% · 1st +{raceExp(picked.grade, 1, raceBonus)} EXP</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Surface', selectedUma.aptitudes.surface[picked.surface]],
                ['Distance', selectedUma.aptitudes.distance[picked.distanceCategory]],
                ['Strategy', selectedUma.aptitudes.strategy[strategy]],
              ].map(([label, grade]) => (
                <div key={label} className="rounded-xl bg-white p-2">
                  <p className="text-xs font-bold text-ink-soft">{label}</p>
                  <p className="text-xl font-extrabold text-sky-deep">{grade}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-extrabold">Race skills</p>
                <span className="text-xs font-extrabold text-violet-700">{skillLoadout.cost} / {skillLoadout.cap} SP</span>
              </div>
              <div className="grid gap-2">
                {selectedUma.skillLibrary.map((unlock) => {
                  const skill = content.skills.byId.get(unlock.skillId)
                  if (!skill) return null
                  const own = unlock.origin === 'own-unique'
                  const compiled = compileRaceSkill(skill)
                  const supported = raceSkillSupported(compiled)
                  const compatible = supported && raceSkillCompatibleWithCourse(compiled, picked)
                  const equipped = own || selectedUma.loadoutSkillIds.includes(skill.id)
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      aria-pressed={equipped}
                      disabled={own || (!supported && !equipped) || savingSkillId !== null || starting}
                      onClick={() => void toggleSkill(skill.id)}
                      className={`flex min-h-11 items-center justify-between rounded-xl border-2 px-3 text-left text-sm font-bold ${equipped ? 'border-violet-400 bg-violet-50' : 'border-white bg-white'} disabled:opacity-65`}
                    >
                      <span className="truncate">{equipped ? '✓ ' : ''}{skill.name}</span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {own ? (compatible ? 'Unique' : supported ? 'Unique · wrong course' : 'Unique · later') :
                          supported ? `${skill.costSp ?? '—'} SP${compatible ? '' : ' · wrong course'}` : 'Later'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 font-extrabold">Field preview</p>
              {!preview && !previewError && <p className="text-sm text-ink-soft">Building deterministic field…</p>}
              {previewError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-danger">{previewError}</p>}
              {preview && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {preview.runners.map((runner, gate) => {
                    const template = content.umas.byId.get(runner.templateId)
                    const frame = content.atlases['uma-icons'].descriptor.frames[runner.templateId]
                    const page = frame ? content.atlases['uma-icons'].descriptor.pages[frame.page] : undefined
                    const url = frame ? content.atlases['uma-icons'].pageUrls[frame.page] : undefined
                    const asset = frame && page && url ? { url, frame, pageWidth: page.width, pageHeight: page.height } : null
                    return (
                      <div key={`${gate}:${runner.templateId}`} className={`w-16 shrink-0 rounded-xl border-2 p-1 text-center ${runner.isPlayer ? 'border-gold bg-gold/15' : 'border-white bg-white'}`}>
                        <AtlasSprite asset={asset} alt={`${template?.name ?? runner.templateId} icon`} className="rounded-lg" fallback={<div className="flex h-full items-center justify-center">🐴</div>} />
                        <p className="mt-1 truncate text-[9px] font-extrabold">{gate + 1}. {runner.isPlayer ? 'You' : template?.name ?? runner.templateId}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 font-extrabold">Strategy</p>
              <div className="grid grid-cols-2 gap-2">
                {STRATEGIES.map((value) => (
                  <m.button
                    key={value}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { setStrategy(value); setStartError(null) }}
                    className={`min-h-12 rounded-xl border-2 px-3 font-extrabold ${strategy === value ? 'border-sky bg-sky text-white text-outline' : 'border-white bg-white text-ink'}`}
                  >
                    {STRATEGY_LABEL[value]} · {selectedUma.aptitudes.strategy[value]}
                  </m.button>
                ))}
              </div>
            </div>
            {(lockReason || startError) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-danger">{startError ?? lockReason}</p>}
            <GameButton variant="go" size="lg" disabled={!promotionRequired && (Boolean(lockReason) || Boolean(previewError) || !preview || starting)} onClick={() => promotionRequired ? navigate(`/scenario/${encodeURIComponent(selectedUmaId)}/start`) : void start()}>
              {promotionRequired ? 'Review promotion' : starting ? 'Preparing…' : 'Start race'}
            </GameButton>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
