// Campaign fight (D265): tap an enemy to attack, or pick a skill first. Weak hits chip each foe's shield (its icons
// show what it is weak to); a Break leaves it open to full damage for two rounds. The result settles itself.
import {
  battleBroken, rpgLevelReveal, rpgMemberLevel,
  type BattleAction, type BattleState, type BattleUnit, type RpgSettlement,
} from '@racer/domain'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Link, useNavigate, useParams } from 'react-router'
import { abandonRpgFight, actRpgFight, beginRpgFight, finishRpgFight, readRpgFight, type RpgFightView } from '../../game/rpg-local'
import { gameRuntime } from '../../game/runtime'
import { InspirationTokenIcon } from '../../ui/InspirationTokenIcon'
import { ScreenState } from '../../ui/ScreenState'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { RpgEnemyPortrait } from '../../ui/rpg/RpgEnemyPortrait'
import { RpgPortrait } from '../../ui/rpg/RpgPortrait'
import { describeCue, previewTarget, skillChoices, type BattleMode } from '../../ui/rpg/battle-view'
import { useBattlePlayback } from '../../ui/rpg/useBattlePlayback'
import { ElementMark, GhostButton, PrimaryButton, RpgBar, ShieldBadge, WeaknessIcons, formatRpgLevel } from '../../ui/rpg/rpg-ui'
import { RpgFrame, commit, pushToast, useRpg } from './RpgScreen'

export function RpgFightScreen() {
  const { presetId = '', chapterId = '' } = useParams()
  const { content, chapters, release } = useRpg()
  const navigate = useNavigate()
  const chapter = chapters?.find((c) => c.id === chapterId) ?? null
  const mapPath = `/rpg/party/${presetId}/${chapterId}`
  const [view, setView] = useState<RpgFightView | null | undefined>(undefined)
  const [state, setState] = useState<BattleState | null>(null)
  const [count, setCount] = useState(0)
  const [actorId, setActorId] = useState<string | null>(null)
  const [mode, setMode] = useState<BattleMode>({ kind: 'attack' })
  const [skills, setSkills] = useState(false)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [settled, setSettled] = useState<RpgSettlement | null>(null)
  const lock = useRef(false)
  const playback = useBattlePlayback(Boolean(useReducedMotion()))
  const load = async () => {
    const next = await readRpgFight(presetId, chapterId)
    setView(next); setState(next?.step.state ?? null); setCount(next?.actions.length ?? 0); setActorId(null); setMode({ kind: 'attack' })
  }
  useEffect(() => { setSettled(null); void load().catch((e: unknown) => { pushToast(String(e)); setView(null) }) }, [presetId, chapterId])

  const castName = (id: string) => release?.status === 'ready' ? release.cast.find((c) => c.id === id)?.name ?? id : id
  const name = (id: string) => {
    const enemy = state?.input.enemies.find((e) => e.id === id)
    return enemy ? castName(enemy.castId) : content.umas.byId.get(id)?.name ?? id
  }
  const living = state?.units.filter((u) => u.side === 'ally' && u.hp > 0 && !state.acted.includes(u.id)) ?? []
  const actor = living.find((u) => u.id === actorId) ?? living[0] ?? null
  const choices = useMemo(() => state && actor ? skillChoices(state, actor.id) : [], [state, actor?.id])
  const node = chapter?.nodes.find((n) => n.id === view?.run.battle?.nodeId)

  if (!chapter) return <ScreenState title="Loading fight" detail="Preparing the chapter…" action={{ label: 'Map', to: mapPath }} />
  if (settled) return <FightResult back={mapPath} settled={settled} chapterTitle={chapter.title} nodeName={chapter.nodes.find((n) => n.id === settled.result?.nodeId)?.name ?? ''} name={name}
    onMap={() => navigate(mapPath)} onAgain={async (nodeId) => { if (await commit(() => beginRpgFight(chapter, presetId, nodeId))) { setSettled(null); await load() } }} lastNode={view?.run.battle?.nodeId ?? settled.result?.nodeId ?? null} />
  if (view === undefined) return <div className="h-dvh bg-stage" aria-label="Loading fight" />
  if (!view || !state) return <ScreenState title="No open fight" detail="Pick a node on the map to start one." action={{ label: 'Map', to: mapPath }} />

  const act = async (action: BattleAction) => {
    if (lock.current || !view.run.battle) return
    lock.current = true; setBusy(true)
    try {
      const step = await actRpgFight(presetId, chapterId, view.run.battle.battleId, count, action)
      setState(step.state); setCount((n) => n + 1); setMode({ kind: 'attack' })
      if (!step.state.acted.includes(action.actorId)) setActorId(action.actorId)
      else setActorId(null)
      await playback.play(step.cues.filter((c) => c.kind !== 'intent'))
      if (step.state.outcome !== 'active') {
        const result = await finishRpgFight(chapter, presetId, view.run.battle.battleId)
        await gameRuntime.refreshLocalState()
        gameRuntime.schedule()
        setSettled(result)
      }
    } catch (error) { pushToast(error instanceof Error ? error.message : String(error)); await load() }
    finally { lock.current = false; setBusy(false) }
  }
  const tapUnit = (unit: BattleUnit) => {
    if (busy || playback.playing || !actor) return
    if (unit.side === 'ally') {
      if (mode.kind === 'guard') { if (unit.id !== actor.id && unit.hp > 0) void act({ kind: 'guard', actorId: actor.id, targetId: unit.id }); return }
      if (unit.hp > 0 && !state.acted.includes(unit.id)) { setActorId(unit.id); setMode({ kind: 'attack' }) }
      return
    }
    if (unit.hp <= 0 || mode.kind === 'guard') return
    void act(mode.kind === 'skill' ? { kind: 'skill', actorId: actor.id, targetId: unit.id, skill: mode.ref } : { kind: 'attack', actorId: actor.id, targetId: unit.id })
  }
  const skill = mode.kind === 'skill' ? choices.find((c) => JSON.stringify(c.ref) === JSON.stringify(mode.ref)) : null
  const hint = playback.cue ? describeCue(playback.cue, name)
    : mode.kind === 'guard' ? `Tap an ally for ${name(actor?.id ?? '')} to guard`
    : skill ? `Tap an enemy: ${skill.skill.label} · ${skill.skill.mp} MP${skill.skill.target === 'all' ? ' (hits all)' : skill.skill.target === 'random' ? ` (${skill.skill.hits} random hits)` : skill.skill.hits > 1 ? ` (${skill.skill.hits} hits)` : ''}`
    : actor ? `${name(actor.id)}: tap an enemy to attack` : ''
  const enemies = state.units.filter((u) => u.side === 'enemy')
  const allies = state.units.filter((u) => u.side === 'ally')
  return <RpgFrame back={mapPath} backLabel="Map (fight is saved)" eyebrow={chapter.title} title={node?.name ?? 'Fight'} guide="weakness" playing
    headline={{ label: 'Round', value: state.round }} trailing={<button type="button" aria-label="Fight menu" onClick={() => setMenu(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft">⋯</button>}>
    <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2" onClick={() => { if (playback.playing) playback.skip() }}>
      <div className="flex flex-1 flex-wrap content-center justify-center gap-2" aria-label="Enemies">{enemies.map((unit) => {
        const enemy = state.input.enemies.find((e) => e.id === unit.id)!
        const intent = state.intents.find((i) => i.enemyId === unit.id)
        const move = intent && [...enemy.moves, ...enemy.phaseTwo?.moves ?? []].find((m) => m.id === intent.moveId)
        const preview = actor && unit.hp > 0 && mode.kind !== 'guard' ? previewTarget(state, actor.id, mode, unit.id) : null
        const hit = playback.cue && 'targetId' in playback.cue && playback.cue.targetId === unit.id
        return <button key={unit.id} type="button" disabled={unit.hp <= 0 || busy} onClick={(e) => { e.stopPropagation(); tapUnit(unit) }}
          aria-label={`${name(unit.id)}, ${enemy.element}, HP ${unit.hp} of ${enemy.stats.hp}, ${battleBroken(unit) ? 'broken' : `shield ${unit.shield}`}`}
          className={`relative flex flex-col items-center rounded-md border p-2 text-center transition-transform ${enemies.length <= 2 ? 'w-[46%]' : 'w-[31%]'} ${hit ? 'scale-[1.04] border-accent' : 'border-hairline-dark'} ${unit.hp <= 0 ? 'opacity-30' : 'bg-stage-soft'} ${enemy.rank !== 'regular' ? 'ring-1 ring-white/30' : ''}`}>
          <RpgEnemyPortrait content={content} artId={release?.status === 'ready' ? release.portraits[enemy.castId] : undefined} name={name(unit.id)} className={enemy.rank !== 'regular' ? 'h-24 w-20' : 'h-20 w-16'} />
          <p className="mt-1 flex max-w-full items-center gap-0.5 text-[12px] font-semibold"><ElementMark element={enemy.element} /><span className="truncate">{name(unit.id)}</span></p>
          <RpgBar className="mt-1 w-full" value={unit.hp} max={enemy.stats.hp} />
          <p className="text-[10px] text-ink-on-dark-soft">{unit.hp}/{enemy.stats.hp}</p>
          <div className="mt-1 flex w-full items-center justify-center gap-1.5"><ShieldBadge value={unit.shield} broken={battleBroken(unit)} /><WeaknessIcons weaknesses={enemy.weaknesses} /></div>
          {battleBroken(unit) && <span className="absolute -top-2 left-1 rounded-xs bg-accent px-1 text-[10px] font-bold text-ink">BREAK</span>}
          {preview && !preview.error && <span className={`absolute -top-2 right-1 rounded-xs px-1 text-[10px] font-bold ${preview.weak ? 'bg-[#ffd84d] text-ink' : 'bg-stage text-ink-on-dark'}`}>{preview.amount}{preview.breaks ? ' BREAK' : preview.chips ? ` −${preview.chips}` : ''}</span>}
          {move && unit.hp > 0 && <p className="mt-1 line-clamp-2 text-[10px] leading-3 text-ink-on-dark-soft">{battleBroken(unit) ? 'Broken: loses its turn' : `${move.label} → ${intent!.targetId === 'all' ? 'all' : name(intent!.targetId)}`}</p>}
        </button>
      })}</div>
      <p aria-live="polite" className={`min-h-8 text-center font-semibold text-accent ${playback.cue?.kind === 'break' ? 'font-display text-[22px] leading-7 tracking-wide' : 'text-[12px] leading-4'}`}>{hint}</p>
      <div className="grid grid-cols-5 gap-1" aria-label="Party">{allies.map((unit) => {
        const ally = state.input.allies.find((a) => a.id === unit.id)!
        const done = state.acted.includes(unit.id) || unit.hp <= 0
        const selected = actor?.id === unit.id
        const hit = playback.cue && 'targetId' in playback.cue && playback.cue.targetId === unit.id
        return <button key={unit.id} type="button" onClick={(e) => { e.stopPropagation(); tapUnit(unit) }} disabled={busy}
          aria-label={`${name(unit.id)}, HP ${unit.hp} of ${ally.stats.hp}, MP ${unit.mp} of ${ally.stats.mp}${done ? ', done' : ''}`}
          className={`min-w-0 rounded-sm border p-1 text-left ${selected ? 'border-accent bg-accent/15' : hit ? 'border-[#ff8a5c]' : 'border-hairline-dark'} ${done ? 'opacity-50' : ''}`}>
          <RpgPortrait content={content} compact artwork="icon" outfitId={ally.id} name={name(ally.id)} weapon={ally.weapon} element={ally.signature} className="aspect-square w-full" />
          <RpgBar className="mt-1" value={unit.hp} max={ally.stats.hp} />
          <RpgBar className="mt-0.5" value={unit.mp} max={ally.stats.mp} tone="mp" />
          <p className="truncate text-[9px]">{unit.hp <= 0 ? 'KO' : done ? 'Done' : `${unit.mp} MP`}</p>
        </button>
      })}</div>
    </section>
    <footer className="shrink-0 border-t border-hairline-dark bg-stage-soft px-3 pt-2 pb-2">
      <div className="grid grid-cols-3 gap-2">
          {(['attack', 'skill', 'guard'] as const).map((kind) => <button key={kind} type="button" disabled={busy || playback.playing || !actor || (kind === 'skill' && choices.length === 0)}
            aria-pressed={mode.kind === kind} onClick={() => { if (kind === 'skill') setSkills(true); else setMode({ kind }) }}
            className={`min-h-12 rounded-sm border text-sm font-semibold disabled:opacity-40 ${mode.kind === kind ? 'border-accent bg-accent/15 text-accent' : 'border-hairline-dark bg-stage'}`}>
            {kind === 'skill' ? `Skill${choices.length ? ` (${choices.length})` : ''}` : kind === 'attack' ? 'Attack' : 'Guard'}</button>)}
      </div>
    </footer>
    {skills && actor && <RpgModalFocus onClose={() => setSkills(false)}><div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setSkills(false)}>
      <div role="dialog" aria-modal="true" aria-label="Skills" onClick={(e) => e.stopPropagation()} className="pb-safe w-full space-y-2 rounded-t-lg border border-hairline-dark bg-stage-soft p-4">
        <p className="text-sm">{name(actor.id)} · {actor.mp} MP</p>
        {choices.map((choice) => {
          const weakTargets = enemies.filter((u) => u.hp > 0 && state.input.enemies.find((e) => e.id === u.id)!.weaknesses.element === choice.skill.element)
          return <button key={JSON.stringify(choice.ref)} type="button" disabled={!choice.affordable} onClick={() => { setMode({ kind: 'skill', ref: choice.ref }); setSkills(false) }}
            className="flex min-h-14 w-full items-center justify-between gap-2 rounded-sm border border-hairline-dark bg-stage p-3 text-left disabled:opacity-40">
            <span><span className="flex items-center gap-1 font-semibold"><ElementMark element={choice.skill.element} />{choice.skill.label}{choice.level > 1 ? ` Lv${choice.level}` : ''}</span>
              <span className="block text-[11px] text-ink-on-dark-soft">{choice.skill.target === 'all' ? 'All enemies' : choice.skill.target === 'random' ? `${choice.skill.hits} hits on random enemies` : choice.skill.hits > 1 ? `${choice.skill.hits} hits` : 'One enemy'}{choice.skill.support ? ` · party ${choice.skill.support}` : ''}{weakTargets.length ? ` · WEAK: ${weakTargets.map((u) => name(u.id)).join(', ')}` : ''}</span></span>
            <span className="text-sm font-semibold">{choice.skill.mp} MP</span>
          </button>
        })}
      </div></div></RpgModalFocus>}
    {menu && <RpgModalFocus onClose={() => setMenu(false)}><div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setMenu(false)}>
      <div role="dialog" aria-modal="true" aria-label="Fight menu" onClick={(e) => e.stopPropagation()} className="pb-safe w-full space-y-2 rounded-t-lg border border-hairline-dark bg-stage-soft p-4">
        <Link to={mapPath} className="flex min-h-12 items-center justify-center rounded-sm border border-hairline-dark">Back to map · the fight stays open</Link>
        <GhostButton className="w-full" onClick={() => { void commit(() => abandonRpgFight(presetId, chapterId)).then((ok) => { if (ok) navigate(mapPath) }) }}>Give up · no reward, MP unchanged</GhostButton>
      </div></div></RpgModalFocus>}
  </RpgFrame>
}

function FightResult({ back, settled, chapterTitle, nodeName, name, onMap, onAgain, lastNode }: {
  back: string; settled: RpgSettlement; chapterTitle: string; nodeName: string; name: (id: string) => string
  onMap: () => void; onAgain: (nodeId: string) => Promise<void>; lastNode: string | null
}) {
  const { content } = useRpg()
  const result = settled.result
  const [busy, setBusy] = useState(false)
  const again = async () => { if (!lastNode) return; setBusy(true); await onAgain(lastNode); setBusy(false) }
  const win = settled.outcome === 'win'
  return <RpgFrame back={back} backLabel="Map" eyebrow={chapterTitle} title={win ? 'Victory' : 'Defeated'} guide="map">
    <h2 className="text-3xl">{win ? 'Victory!' : 'Defeated'}</h2>
    <p className="mt-1 text-sm text-ink-on-dark-soft">{nodeName}{result ? ` · ${result.rounds} rounds` : ''}</p>
    {win && result ? <>
      <div className="mt-3 flex items-center gap-4 rounded-sm bg-stage-soft p-3 text-sm">
        <span className="flex items-center gap-1"><InspirationTokenIcon kind="slot" size={20} />+{result.tokens.slot}</span>
        <span className="flex items-center gap-1"><InspirationTokenIcon kind="skill" size={20} />+{result.tokens.skill}</span>
        <span className="text-[11px] text-ink-on-dark-soft">{chapterTitle} Inspiration tokens</span>
      </div>
      <div className="mt-3 space-y-2">{result.members.map((member) => {
        const profile = settled.profiles.find((p) => p.outfitId === member.outfitId)
        const reveal = profile ? rpgLevelReveal(profile, { ...member }) : null
        const up = member.afterLevel > member.beforeLevel
        return <div key={member.outfitId} className="grid grid-cols-[44px_1fr] items-center gap-2 rounded-sm border border-hairline-dark p-2">
          <RpgPortrait content={content} compact artwork="icon" outfitId={member.outfitId} name={name(member.outfitId)} weapon={profile?.weapon ?? null} element={profile?.defaultSignature ?? null} className="aspect-square w-11" />
          <div className="min-w-0 text-[12px]">
            <p className="flex justify-between gap-2"><span className="truncate font-semibold">{name(member.outfitId)}</span><span className="text-accent">+{member.delta} EXP</span></p>
            <p className={up ? 'font-semibold text-accent' : 'text-ink-on-dark-soft'}>{up ? `Level up! ${formatRpgLevel(rpgMemberLevel({ tier: member.beforeTier, level: member.beforeLevel }))} → ${formatRpgLevel(rpgMemberLevel({ tier: member.afterTier, level: member.afterLevel }))}` : formatRpgLevel(rpgMemberLevel({ tier: member.afterTier, level: member.afterLevel }))}
              {reveal && reveal.points > 0 ? ` · +${reveal.points} skill point${reveal.points > 1 ? 's' : ''}` : ''}</p>
          </div>
        </div>
      })}</div>
    </> : <p className="mt-3 text-sm">No reward, no penalty. MP is back to what it was when the fight began. Learn a weakness skill, rest at a camp or bring a different party.</p>}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <GhostButton disabled={busy || !lastNode} onClick={() => void again()}>{win ? 'Fight again' : 'Retry'}</GhostButton>
      <PrimaryButton onClick={onMap}>Back to map</PrimaryButton>
    </div>
  </RpgFrame>
}
