// Safe-checkpoint elemental choices, preset equipment and explicit promotion (docs/design/uma-rpg.md, T096).
import { RPG_DEPTH_GATES, RPG_ELEMENTS, RPG_SKILL_CATALOG, STATS, eligibleRpgCells, projectRpgStats,
  promoteRpgOutfit, rpgActiveSlots, rpgSkillKey, rpgTreePointsEarned, rpgTreePointsSpent, spendRpgTreePoint,
  validateRpgLoadout, type RpgElement, type RpgSkillRef } from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { RpgProgressionHost, type RpgProgressionView } from '../../game/rpg-progression-host'
import { Button } from '../Button'
import { Panel } from '../Panel'
import { RpgModalFocus } from './RpgModalFocus'
import { RpgClassEditor } from './RpgClassEditor'
import { RPG_ELEMENT_LABELS } from './RpgPortrait'
const branchLabels = { foundation: 'Foundation', focused: 'Focused', area: 'Area', committed: 'Committed', multi: 'Multi-hit', role: 'Role mastery', hybrid: 'Hybrid', signature: 'Signature' }
const targetLabels = { enemy: 'one enemy', 'all-enemies': 'all enemies', ally: 'one ally', 'all-allies': 'all allies', self: 'self' }
const skillLabel = (ref: RpgSkillRef) => `${RPG_ELEMENT_LABELS[ref.element]} · ${branchLabels[ref.branch]}`

function Choice({ checked, onChange, children, disabled = false }: { checked: boolean; onChange: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-sm border border-hairline px-3 py-2 text-xs">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-5 w-5 shrink-0" />{children}</label>
}
export function RpgProgressionEditor({ host, outfitId, onSync, showProfile = false }: { host: RpgProgressionHost; outfitId: string; onSync: () => void | Promise<void>; showProfile?: boolean }) {
  const [view, setView] = useState<RpgProgressionView | null>(null)
  const [error, setError] = useState('')
  const [element, setElement] = useState<RpgElement>('fire')
  const [busy, setBusy] = useState(false)
  const [promotion, setPromotion] = useState(false)
  const [legacy, setLegacy] = useState<RpgSkillRef[]>([])
  const [discard, setDiscard] = useState(false)
  const [presetId, setPresetId] = useState('')
  const [signature, setSignature] = useState<RpgElement | null>(null)
  const [loadout, setLoadout] = useState<RpgSkillRef[] | null>(null)
  useEffect(() => {
    setLoadout(null); setSignature(null); setLegacy([]); setPromotion(false)
    const subscription = liveQuery(() => host.read(outfitId)).subscribe({ next: (next) => setView(next), error: (e: unknown) => setError(String(e)) })
    return () => subscription.unsubscribe()
  }, [host, outfitId])
  if (!view) return <p role="status">{error || 'Reading accepted RPG progression…'}</p>
  const profile = view.outfit.data.profile
  const points = rpgTreePointsEarned(profile.level) - rpgTreePointsSpent(profile.tree)
  const cells = eligibleRpgCells(profile)
  const activeElement = cells.some((c) => c.element === element) ? element : cells[0]!.element
  const preset = view.presets.find((p) => p.id === presetId) ?? view.presets[0]
  const slot = preset?.data.slots.find((s) => s?.outfitId === outfitId)
  const equipped = loadout ?? slot?.loadout ?? []
  const activeSignature = signature ?? slot?.signature ?? profile.defaultSignature
  const learned = [...profile.tree, ...profile.legacy]
  const blocked = Boolean(view.blocked || busy)
  const run = async (action: () => Promise<string>) => {
    if (blocked) return
    setBusy(true); setError('')
    try { await action(); setPromotion(false); await onSync(); setLoadout(null); setSignature(null) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  const toggle = (refs: RpgSkillRef[], ref: RpgSkillRef) => refs.some((r) => rpgSkillKey(r) === rpgSkillKey(ref))
    ? refs.filter((r) => rpgSkillKey(r) !== rpgSkillKey(ref)) : [...refs, ref]
  let preview: ReturnType<typeof promoteRpgOutfit> | null = null
  try { if (promotion) preview = promoteRpgOutfit(profile, legacy, discard) } catch { /* Explicit choices remain incomplete. */ }
  const statsBefore = projectRpgStats(profile), statsAfter = preview && projectRpgStats(preview.profile)
  return <div className="space-y-3 text-ink">
    {showProfile && <Panel><h2 className="text-xl">Tier {profile.tier} · RPG Lv{profile.level}</h2><p className="mt-1 text-sm">{profile.exp} {profile.level === 50 ? 'banked EXP' : 'EXP toward next level'} · {points} tree points · {rpgActiveSlots(profile.level)} slots</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{STATS.map((s) => <div key={s}><dt className="text-ink-soft">{s}</dt><dd>{statsBefore[s]}</dd></div>)}</dl></Panel>}
    {view.blocked && <p role="status" className="rounded-sm bg-accent-wash p-3 text-xs">{view.blocked}</p>}
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <RpgClassEditor key={outfitId} profile={profile} blocked={busy ? 'RPG change saving…' : view.blocked} onChange={async (style, weapon) => {
      await host.changeClass(view, style, weapon); await onSync()
    }} />
    <Panel><div className="flex items-center justify-between gap-3"><h3 className="text-lg">Elemental skill trees</h3><span className="text-sm font-semibold text-accent-strong">{points} points</span></div>
      <p className="mt-1 text-xs text-ink-soft">Tier {profile.tier} · one point buys a skill or +1 skill level, up to 5. Choices cannot be refunded.</p>
      <div className="mt-3 flex flex-wrap gap-1" aria-label="Elemental trees">{cells.map((c) => <button key={c.element} aria-pressed={activeElement === c.element}
        className={`min-h-11 rounded-sm border px-3 text-xs ${activeElement === c.element ? 'border-accent bg-accent-wash' : 'border-hairline'}`} onClick={() => setElement(c.element)}>{RPG_ELEMENT_LABELS[c.element]} · {c.affinity}</button>)}</div>
      <div className="mt-3 space-y-2">{RPG_SKILL_CATALOG.filter((s) => s.weapon === profile.weapon && s.element === activeElement).map((definition) => {
        const ref: RpgSkillRef = { tier: profile.tier, weapon: profile.weapon, element: activeElement, depth: definition.depth, branch: definition.branch }
        const known = profile.tree.find((s) => rpgSkillKey(s) === rpgSkillKey(ref))
        let reason = ''
        try { spendRpgTreePoint(profile, ref) } catch (e) { reason = e instanceof Error ? e.message : String(e) }
        return <div key={definition.id} className="border-t border-hairline pt-2"><div className="flex items-center justify-between gap-2"><div>
          <p className="text-xs font-semibold">{skillLabel(ref)}</p><p className="mt-1 text-[11px] text-ink-soft">Depth {definition.depth} · opens Lv{RPG_DEPTH_GATES[definition.depth - 1]} · {known ? `Skill Lv${known.level}/5` : 'Not learned'}</p></div>
          <Button variant="secondary" className="shrink-0 whitespace-nowrap" disabled={blocked || Boolean(reason)} onClick={() => { void run(() => host.learn(view, ref)) }}>{known ? '+1 level' : 'Learn'}</Button></div>
          <p className="mt-1 text-[11px] text-ink-soft">{definition.heal > 0 ? definition.base + definition.rider > 0 ? 'Damage + healing' : 'Healing / support' : `${definition.channel} damage`} · {targetLabels[definition.target]} · {definition.mp} MP · {definition.branch === 'multi' ? 'two smaller hits · ' : ''}{definition.status ?? 'no status'}</p>
          {reason && <p className="mt-1 text-[11px] text-ink-soft">{reason}</p>}</div>
      })}</div></Panel>
    <Panel><h3 className="text-lg">Equip for future battles</h3><p className="mt-1 text-xs text-ink-soft">Attack and Guard are always available. Skills only change the selected preset, never an entered fight.</p>
      {!preset ? <p className="mt-2 text-xs">Add this outfit to a saved party first.</p> : <>
        <label className="mt-3 block text-xs">Party preset<select className="mt-1 min-h-11 w-full rounded-sm border border-hairline bg-panel px-3" value={preset.id} onChange={(e) => { setPresetId(e.target.value); setLoadout(null); setSignature(null) }}>{view.presets.map((p) => <option key={p.id} value={p.id}>{p.data.name}</option>)}</select></label>
        <label className="mt-3 block text-xs">Active signature<select className="mt-1 min-h-11 w-full rounded-sm border border-hairline bg-panel px-3" value={activeSignature} onChange={(e) => setSignature(e.target.value as RpgElement)}>{RPG_ELEMENTS.filter((e) => profile.affinities[e]).map((e) => <option key={e} value={e}>{RPG_ELEMENT_LABELS[e]}</option>)}</select></label>
        <p className="my-2 text-xs">{equipped.length}/{rpgActiveSlots(profile.level)} active slots · at most two legacy skills</p>
        <div className="space-y-2">{learned.map((skill) => <Choice key={rpgSkillKey(skill)} disabled={blocked} checked={equipped.some((s) => rpgSkillKey(s) === rpgSkillKey(skill))}
          onChange={() => setLoadout(toggle(equipped, skill))}><span>{skillLabel(skill)} · Lv{skill.level}{skill.tier < profile.tier ? ` · legacy T${skill.tier}` : ''}</span></Choice>)}</div>
        {!validateRpgLoadout(profile, activeSignature, equipped) && <p className="mt-2 text-xs text-danger">Choose learned skills within the slot limit, including at most two legacy skills.</p>}
        <Button className="mt-3 w-full" disabled={blocked || !validateRpgLoadout(profile, activeSignature, equipped)} onClick={() => { void run(() => host.equip(view, preset.id, activeSignature, equipped)) }}>Save loadout</Button>
      </>}</Panel>
    {profile.level === 50 && <Panel><h3 className="text-lg">Class promotion</h3><p className="mt-1 text-xs text-ink-soft">{profile.exp} banked EXP carries forward. Style, weapon and stats stay earned. Choose up to two legacy techniques.</p>
      <Button className="mt-3 w-full" disabled={blocked} onClick={() => { setLegacy([]); setDiscard(false); setPromotion(true) }}>Review Tier {profile.tier + 1} promotion</Button></Panel>}
    {promotion && <RpgModalFocus onClose={() => setPromotion(false)}><div className="fixed inset-0 z-50 flex items-end bg-black/60"><div role="dialog" aria-modal="true" aria-label="Confirm class promotion" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-lg bg-panel p-4 pb-safe text-ink">
      <h3 className="text-xl">Promote to Tier {profile.tier + 1}</h3><p className="mt-2 text-xs text-ink-soft">Current mastery is archived, not reset from history. Only selected legacy skills remain usable; other equipped skills are removed from all presets. Your new tree starts empty.</p>
      <p className={`mt-2 text-xs ${legacy.length > 2 ? 'text-danger' : 'text-ink-soft'}`}>{legacy.length}/2 legacy techniques selected</p>
      <div className="mt-3 space-y-2">{learned.map((s) => <Choice key={rpgSkillKey(s)} checked={legacy.some((r) => rpgSkillKey(r) === rpgSkillKey(s))}
        disabled={busy} onChange={() => setLegacy(toggle(legacy, s))}>{RPG_ELEMENT_LABELS[s.element]} · {s.branch} · Skill Lv{s.level} · Tier {s.tier}</Choice>)}</div>
      {points > 0 && <div className="mt-3"><Choice checked={discard} disabled={busy} onChange={() => setDiscard(!discard)}>Discard {points} unspent current-tier points explicitly</Choice></div>}
      {preview && statsAfter && <div className="mt-3 rounded-sm bg-sunken p-3 text-xs"><p>Tier {profile.tier} Lv50 → Tier {preview.profile.tier} Lv{preview.profile.level}</p><p className="mt-1">{profile.exp} banked EXP applied · {preview.profile.exp} EXP left</p>
        {STATS.map((s) => <p key={s} className="mt-1">{s}: {statsBefore[s]} → {statsAfter[s]}</p>)}</div>}
      <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setPromotion(false)}>Cancel</Button><Button className="flex-1" disabled={blocked || !preview} onClick={() => { void run(() => host.promote(view, legacy, discard)) }}>Confirm promotion</Button></div>
    </div></div></RpgModalFocus>}
  </div>
}
