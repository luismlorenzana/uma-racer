// Campaign fight (D265, D278): tap an enemy to attack, or pick a skill first. Weak parts chip each foe's shield (its
// icons show what it is weak to); a Break leaves it open to full damage for two rounds. Mages, Spell Blades and Summoners
// act twice; a Cleric's skill carries a blessing. A full Limit Break bar puts a badge on her portrait (D311). The result
// settles itself.
import {
  battleActionsLeft, battleBroken, rpgHand, rpgLevelReveal, rpgMemberLevel,
  type BattleAction, type BattleState, type BattleUnit, type RpgNodeRef, type RpgSettlement, type RpgWeapon,
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
import { actionFor, blessingChoices, describeCue, limitMode, limitNow, limitOptions, limitReady, previewTarget, skillChoices,
  type BattleMode, type SkillChoice } from '../../ui/rpg/battle-view'
import { BurstIcon } from '../../ui/icons'
import { useBattlePlayback } from '../../ui/rpg/useBattlePlayback'
import { ElementMark, GhostButton, KindMark, PrimaryButton, RpgBar, ShieldBadge, WEAPON_KIND_LABEL, WeaknessIcons, WeaponKindMark, formatRpgLevel } from '../../ui/rpg/rpg-ui'
import { RpgFrame, commit, pushToast, skillKinds, useRpg } from './RpgScreen'

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
  const [blessFor, setBlessFor] = useState<SkillChoice | null>(null)
  const [lastBlessing, setLastBlessing] = useState<Record<string, string>>({})
  const [menu, setMenu] = useState(false)
  const [limitFor, setLimitFor] = useState<string | null>(null)
  const [limitPicks, setLimitPicks] = useState<RpgNodeRef[]>([])
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
  const living = state?.units.filter((u) => u.side === 'ally' && u.hp > 0 && battleActionsLeft(state, u.id) > 0) ?? []
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
      setActorId(battleActionsLeft(step.state, action.actorId) > 0 ? action.actorId : null)
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
    void act(actionFor(mode, actor.id, unit.id))
  }
  const skill = mode.kind === 'skill' ? choices.find((c) => JSON.stringify(c.ref) === JSON.stringify(mode.ref)) : null
  const actorAlly = actor ? state.input.allies.find((a) => a.id === actor.id)! : null
  const hand = actorAlly ? rpgHand(actorAlly) : null
  const left = actor ? battleActionsLeft(state, actor.id) : 0
  const familiarUsed = !!actor && hand?.free.kind === 'familiar' && state.familiars.includes(actor.id)
  const attackLabel = hand?.free.kind === 'familiar' ? 'Familiar' : hand?.free.kind === 'short-sword' ? 'Slash' : hand?.free.kind === 'staff' ? 'Strike' : 'Attack'
  const weapon: RpgWeapon | undefined = mode.kind === 'attack' ? mode.weapon : undefined
  const turn = hand && hand.actions > 1 ? ` · action ${hand.actions - left + 1} of ${hand.actions}` : ''
  const blessing = skill && mode.kind === 'skill' && mode.blessing ? blessingChoices(state, actor!.id, skill.skill).find((b) => b.id === mode.blessing) : null
  const hint = playback.cue ? describeCue(playback.cue, name)
    : mode.kind === 'guard' ? `Tap an ally for ${name(actor?.id ?? '')} to guard`
    : mode.kind === 'limit' ? `Tap an enemy: LIMIT BREAK · ${mode.name}`
    : skill ? `Tap an enemy: ${skill.skill.label} · ${skill.skill.mp} MP${blessing ? ` · ${blessing.name}` : ''}${turn}`
    : actor ? `${name(actor.id)}: tap an enemy to ${attackLabel.toLowerCase()}${weapon ? ` (${WEAPON_KIND_LABEL[weapon as keyof typeof WEAPON_KIND_LABEL] ?? weapon})` : ''}${turn}` : ''
  const pickSkill = (choice: SkillChoice) => {
    const options = blessingChoices(state, actor!.id, choice.skill)
    if (options.length > 1) { setBlessFor(choice); return }
    setMode({ kind: 'skill', ref: choice.ref, ...(options[0] ? { blessing: options[0].id } : {}) }); setSkills(false)
  }
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
      <p aria-live="polite" className={`min-h-8 text-center font-semibold text-accent ${playback.cue?.kind === 'break' || playback.cue?.kind === 'limit' ? 'font-display text-[22px] leading-7 tracking-wide' : 'text-[12px] leading-4'}`}>{hint}</p>
      <div className="grid grid-cols-5 gap-1" aria-label="Party">{allies.map((unit) => {
        const ally = state.input.allies.find((a) => a.id === unit.id)!
        const done = battleActionsLeft(state, unit.id) <= 0 || unit.hp <= 0
        const selected = actor?.id === unit.id
        const hit = playback.cue && 'targetId' in playback.cue && playback.cue.targetId === unit.id
        const limit = unit.hp > 0 && limitReady(state, unit.id)
        return <div key={unit.id} className="relative min-w-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); tapUnit(unit) }} disabled={busy}
            aria-label={`${name(unit.id)}, HP ${unit.hp} of ${ally.stats.hp}, MP ${unit.mp} of ${ally.stats.mp}${done ? ', done' : ''}`}
            className={`w-full min-w-0 rounded-sm border p-1 text-left ${selected ? 'border-accent bg-accent/15' : hit ? 'border-[#ff8a5c]' : 'border-hairline-dark'} ${done ? 'opacity-50' : ''}`}>
            <RpgPortrait content={content} compact artwork="icon" outfitId={ally.id} name={name(ally.id)} weapons={ally.weapons} className="aspect-square w-full" />
            <RpgBar className="mt-1" value={unit.hp} max={ally.stats.hp} />
            <RpgBar className="mt-0.5" value={unit.mp} max={ally.stats.mp} tone="mp" />
            <p className="truncate text-[9px]">{unit.hp <= 0 ? 'KO' : done ? 'Done' : `${unit.mp} MP${rpgHand(ally).actions > 1 ? ` · ${battleActionsLeft(state, unit.id)}×` : ''}`}</p>
          </button>
          {limit && <button type="button" aria-label={`${name(unit.id)}: Limit Break ready`} disabled={busy || playback.playing}
            onClick={(e) => { e.stopPropagation(); setLimitPicks([]); setLimitFor(unit.id) }}
            className="absolute -top-2 left-1/2 flex h-7 min-w-11 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border border-[#ffd84d] bg-stage px-1.5 text-[10px] font-bold text-[#ffd84d] shadow-[0_0_10px_rgba(255,216,77,0.55)]">
            <BurstIcon size={16} />LB</button>}
        </div>
      })}</div>
    </section>
    <footer className="shrink-0 border-t border-hairline-dark bg-stage-soft px-3 pt-2 pb-2">
      {actorAlly && hand?.free.kind === 'weapon' && <div className="mb-2 grid grid-cols-2 gap-2" aria-label="Attack weapon">
        {actorAlly.weapons.map((w, i) => {
          const on = mode.kind === 'attack' && (mode.weapon ?? actorAlly.weapons[0]) === w && i >= 0
          return <button key={w} type="button" aria-pressed={on} disabled={busy || playback.playing} onClick={() => setMode({ kind: 'attack', weapon: w })}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-sm border text-[12px] font-semibold ${on ? 'border-accent bg-accent/15 text-accent' : 'border-hairline-dark bg-stage'}`}>
            <WeaponKindMark kind={w as keyof typeof WEAPON_KIND_LABEL} />{WEAPON_KIND_LABEL[w as keyof typeof WEAPON_KIND_LABEL]}</button>
        })}
      </div>}
      <div className="grid grid-cols-3 gap-2">
          {(['attack', 'skill', 'guard'] as const).map((kind) => <button key={kind} type="button" disabled={busy || playback.playing || !actor || (kind === 'skill' && choices.length === 0) || (kind === 'attack' && familiarUsed)}
            aria-pressed={mode.kind === kind} onClick={() => { if (kind === 'skill') setSkills(true); else setMode(kind === 'attack' ? { kind, weapon: mode.kind === 'attack' ? mode.weapon : undefined } : { kind }) }}
            className={`min-h-12 rounded-sm border text-sm font-semibold disabled:opacity-40 ${mode.kind === kind ? 'border-accent bg-accent/15 text-accent' : 'border-hairline-dark bg-stage'}`}>
            {kind === 'skill' ? `Skill${choices.length ? ` (${choices.length})` : ''}` : kind === 'attack' ? attackLabel : 'Guard'}</button>)}
      </div>
    </footer>
    {skills && actor && <RpgModalFocus onClose={() => { setSkills(false); setBlessFor(null) }}><div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => { setSkills(false); setBlessFor(null) }}>
      <div role="dialog" aria-modal="true" aria-label={blessFor ? 'Blessing' : 'Skills'} onClick={(e) => e.stopPropagation()} className="pb-safe max-h-[80dvh] w-full space-y-2 overflow-y-auto rounded-t-lg border border-hairline-dark bg-stage-soft p-4">
        {blessFor ? <>
          <p className="text-sm">{blessFor.skill.label} carries a blessing: pick one</p>
          {blessingChoices(state, actor.id, blessFor.skill).map((b) => {
            const branch = blessFor.skill.def.primary
            const preferred = lastBlessing[branch] === b.id
            return <button key={b.id} type="button" onClick={() => { setLastBlessing({ ...lastBlessing, [branch]: b.id }); setMode({ kind: 'skill', ref: blessFor.ref, blessing: b.id }); setBlessFor(null); setSkills(false) }}
              className={`flex min-h-12 w-full items-center justify-between rounded-sm border p-3 text-left ${preferred ? 'border-accent' : 'border-hairline-dark'} bg-stage`}>
              <span className="font-semibold">{b.name}</span><span className="text-[11px] text-ink-on-dark-soft">{blessFor.skill.def.target === 'one' ? 'Focused · 3 stacks' : blessFor.skill.def.target === 'all' ? 'Party' : 'Scatter'}</span>
            </button>
          })}
        </> : <>
        <p className="text-sm">{name(actor.id)} · {actor.mp} MP</p>
        {choices.map((choice) => {
          const kinds = skillKinds(choice.skill.def)
          const weakTargets = enemies.filter((u) => {
            const w = state.input.enemies.find((e) => e.id === u.id)!.weaknesses
            return u.hp > 0 && kinds.some((k) => (w.elements as string[]).includes(k) || (w.weapons as string[]).includes(k))
          })
          const def = choice.skill.def
          return <button key={JSON.stringify(choice.ref)} type="button" disabled={!choice.affordable} onClick={() => pickSkill(choice)}
            className="flex min-h-14 w-full items-center justify-between gap-2 rounded-sm border border-hairline-dark bg-stage p-3 text-left disabled:opacity-40">
            <span><span className="flex items-center gap-1 font-semibold">{kinds.map((k) => <KindMark key={k} kind={k} />)}{choice.skill.label}</span>
              <span className="block text-[11px] text-ink-on-dark-soft">{def.target === 'all' ? 'All enemies' : def.target === 'random' ? `${def.hits.length} hits on random enemies` : def.hits.length > 1 ? `${def.hits.length} hits` : 'One enemy'}{weakTargets.length ? ` · WEAK: ${weakTargets.map((u) => name(u.id)).join(', ')}` : ''}</span></span>
            <span className="text-sm font-semibold">{choice.skill.mp} MP</span>
          </button>
        })}
        </>}
      </div></div></RpgModalFocus>}
    {limitFor && (() => {
      const close = () => { setLimitFor(null); setLimitPicks([]) }
      const { pick, options } = limitOptions(state, limitFor)
      const now = limitNow(state, limitFor)
      const choose = (choice: Parameters<typeof limitMode>[2]) => {
        const next = limitMode(state, limitFor, choice)
        if (!next) { pushToast('That Limit Break is not available'); return }
        setActorId(limitFor); setMode(next); close()
      }
      return <RpgModalFocus onClose={close}><div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={close}>
        <div role="dialog" aria-modal="true" aria-label="Limit Break" onClick={(e) => e.stopPropagation()} className="pb-safe max-h-[80dvh] w-full space-y-2 overflow-y-auto rounded-t-lg border border-[#ffd84d]/60 bg-stage-soft p-4">
          <p className="flex items-center gap-1.5 font-display text-[18px] text-[#ffd84d]"><BurstIcon size={20} />Limit Break · {name(limitFor)}</p>
          {!now ? <p className="text-sm">Ready from her next turn: a Limit Break takes her whole turn, so use it before she acts.</p>
            : options.length === 0 ? <p className="text-sm">Equip a summon in the party to use her Limit Break.</p> : <>
            <p className="text-[12px] text-ink-on-dark-soft">{pick === 2 ? `Pick two summons (the same one twice is fine): each is summoned twice, at 0 MP. ${limitPicks.length}/2 picked.` : 'Her whole turn, at 0 MP. Pick one, then tap an enemy.'}</p>
            {options.map((o) => {
              const count = limitPicks.filter((r) => `${r.tier}:${r.id}` === o.key).length
              return <button key={o.key} type="button" onClick={() => {
                if (pick === 1) { choose(o.choice); return }
                const picks = [...limitPicks, o.choice.skills![0]!]
                if (picks.length < 2) { setLimitPicks(picks); return }
                choose({ skills: picks })
              }} className={`flex min-h-14 w-full items-center justify-between gap-2 rounded-sm border p-3 text-left ${count ? 'border-[#ffd84d]' : 'border-hairline-dark'} bg-stage`}>
                <span><span className="block font-semibold">{o.name}</span><span className="block text-[11px] text-ink-on-dark-soft">{o.detail}</span></span>
                <span className="text-sm font-semibold">{count ? `×${count}` : '0 MP'}</span>
              </button>
            })}
            {pick === 2 && limitPicks.length > 0 && <GhostButton className="w-full" onClick={() => setLimitPicks([])}>Clear picks</GhostButton>}
          </>}
        </div></div></RpgModalFocus>
    })()}
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
          <RpgPortrait content={content} compact artwork="icon" outfitId={member.outfitId} name={name(member.outfitId)} weapons={profile?.weapons ?? []} className="aspect-square w-11" />
          <div className="min-w-0 text-[12px]">
            <p className="flex justify-between gap-2"><span className="truncate font-semibold">{name(member.outfitId)}</span><span className="text-accent">+{member.delta} EXP</span></p>
            <p className={up ? 'font-semibold text-accent' : 'text-ink-on-dark-soft'}>{up ? `Level up! ${formatRpgLevel(rpgMemberLevel({ tier: member.beforeTier, level: member.beforeLevel }))} → ${formatRpgLevel(rpgMemberLevel({ tier: member.afterTier, level: member.afterLevel }))}` : formatRpgLevel(rpgMemberLevel({ tier: member.afterTier, level: member.afterLevel }))}
              {reveal && reveal.points > 0 ? ` · +${reveal.points} skill point${reveal.points > 1 ? 's' : ''}` : ''}</p>
          </div>
        </div>
      })}</div>
    </> : <p className="mt-3 text-sm">No reward, no penalty. MP is back to what it was when the fight began. Equip skills that hit its weaknesses, rest at a camp or bring a different party.</p>}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <GhostButton disabled={busy || !lastNode} onClick={() => void again()}>{win ? 'Fight again' : 'Retry'}</GhostButton>
      <PrimaryButton onClick={onMap}>Back to map</PrimaryButton>
    </div>
  </RpgFrame>
}
