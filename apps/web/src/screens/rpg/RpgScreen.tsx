// Uma RPG: parties, roster, profiles and the chapter launch pad (docs/design/uma-rpg.md#phone-presentation, D263).
// Every screen shares one frame: back, title and the guide. Changes save at once; there is no Save or Sync step.
import {
  RPG_ELEMENTS, RPG_PARTY_SIZE, RPG_TIER_MAX_LEVEL, STRATEGIES, battleSkillLabel, battleSkillMp, canChangeRpgClass,
  canUseRpgSignature, eligibleRpgCells, projectRpgStats, rpgActiveSlots, rpgAffinities, rpgCampaign, rpgChapterCleared,
  rpgExpToNext, rpgMemberLevel, rpgNodeStatus, rpgRunId, rpgSkillKey, rpgTreePointsEarned, rpgTreePointsSpent,
  rpgWeaponsForStyle, RPG_DEPTH_GATES, RPG_B_MAX_DEPTH, RPG_BRANCHES, battleSkillShape,
  type RpgCampaignChapter, type RpgElement, type RpgPresetSaveV1, type RpgProfile, type RpgSkillRef, type RpgWeapon, type Strategy,
} from '@racer/domain'
import { liveQuery } from 'dexie'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { getContentAsset, type LoadedContent } from '../../content/runtime'
import type { RpgRelease } from '../../content/rpg-release'
import { changeRpgOutfitClass, enrollRpgOutfit, learnRpgSkill, promoteRpgOutfitTier, readRpgAccount, rpgOutfitProfiles,
  saveRpgParty, equipRpgSkills, type RpgAccount } from '../../game/rpg-local'
import { gameRuntime } from '../../game/runtime'
import { useGame } from '../../game/store'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { ScreenState } from '../../ui/ScreenState'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
import { RPG_WEAPON_LABELS, RpgPortrait, IdentityGlyph } from '../../ui/rpg/RpgPortrait'
import { orderRpgRoster } from '../../ui/rpg/roster-options'
import { ElementMark, GhostButton, PrimaryButton, RpgBar, RpgCard, RpgSelect, RpgTabs, formatRpgBand, formatRpgLevel } from '../../ui/rpg/rpg-ui'
import { RpgGuide, rpgGuideMemory, type RpgGuidePage } from './RpgGuide'
import { useRpgRelease } from './useRpgRelease'

interface RpgContextValue {
  content: LoadedContent
  account: RpgAccount
  release: RpgRelease | null
  retryRelease: () => void
  chapters: RpgCampaignChapter[] | null
  openGuide: (page?: RpgGuidePage) => void
}
const RpgContext = createContext<RpgContextValue | null>(null)
export function useRpg(): RpgContextValue {
  const value = useContext(RpgContext)
  if (!value) throw new Error('RPG screen must be inside its shell')
  return value
}

const title = (value: string) => value[0]!.toUpperCase() + value.slice(1)
export const pushToast = (message: string) => useGame.getState().pushToast(message)
const skillReach = (branch: RpgSkillRef['branch']): string => {
  const { hits, target } = battleSkillShape(branch)
  return target === 'all' ? 'all foes' : target === 'random' ? `${hits} random hits` : hits > 1 ? `${hits} hits` : 'one foe'
}
/** Commits are local; this only nudges the background sync. */
export async function commit(operation: () => Promise<unknown>): Promise<boolean> {
  try { await operation(); gameRuntime.schedule(); return true }
  catch (error) { pushToast(error instanceof Error ? error.message : String(error)); return false }
}

export function RpgShell() {
  const status = useGame((state) => state.status)
  const persistent = useGame((state) => state.persistent)
  const contentState = useContent()
  const content = contentState.status === 'ready' ? contentState.content : null
  const [account, setAccount] = useState<RpgAccount | null>(null)
  const [error, setError] = useState<string | null>(null)
  const campaign = useRpgRelease(content)
  const [guide, setGuide] = useState<RpgGuidePage | null>(() => rpgGuideMemory.seen() ? null : 'party')
  useEffect(() => {
    if (status !== 'ready' || !persistent) return
    const subscription = liveQuery(readRpgAccount).subscribe({ next: setAccount, error: (e: unknown) => setError(String(e)) })
    return () => subscription.unsubscribe()
  }, [status, persistent])
  const cast = campaign.state?.status === 'ready' ? campaign.state.cast : null
  const chapters = useMemo(() => cast ? rpgCampaign(cast) : null, [cast])
  if (status !== 'ready') return <ScreenState title="RPG unavailable" detail="Open your saved game first." action={{ label: 'Home', to: '/' }} />
  if (!persistent) return <ScreenState title="RPG save unavailable" detail="The RPG needs the saved account. Other modes still work." action={{ label: 'Home', to: '/' }} />
  if (!content) return <ScreenState title="RPG content unavailable" detail="Your private Uma catalog must load first." action={{ label: 'Home', to: '/' }} />
  if (error) return <ScreenState title="RPG save needs attention" detail={error} action={{ label: 'Home', to: '/' }} />
  if (!account) return <div className="h-dvh bg-stage" aria-label="Loading Uma RPG" />
  const close = () => { rpgGuideMemory.remember(); setGuide(null) }
  return <RpgContext.Provider value={{ content, account, release: campaign.state, retryRelease: campaign.retry, chapters, openGuide: (page = 'party') => setGuide(page) }}>
    <Outlet />
    {guide && <RpgGuide startAt={guide} onClose={close} />}
  </RpgContext.Provider>
}

/** The one frame every RPG page uses. */
export function RpgFrame({ back, backLabel, eyebrow, title: heading, guide = 'party', trailing, headline, playing = false, children }: {
  back: string; backLabel: string; eyebrow: string; title: string; guide?: RpgGuidePage; trailing?: ReactNode
  headline?: { label: string; value: ReactNode }; playing?: boolean; children: ReactNode
}) {
  const { openGuide } = useRpg()
  return <MinigameShell playing={playing}>
    <MinigameHeader backTo={back} backLabel={backLabel} eyebrow={eyebrow} title={heading} onGuide={() => openGuide(guide)} guideLabel="How the RPG works" trailing={trailing} headline={headline} />
    {playing ? children : <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-3 pb-8">{children}</div>}
  </MinigameShell>
}

function OutfitIcon({ content, outfitId, name, profile, element, className = 'aspect-square w-full' }: {
  content: LoadedContent; outfitId: string; name: string; profile?: RpgProfile | null; element?: RpgElement | null; className?: string
}) {
  return <RpgPortrait content={content} compact artwork="icon" outfitId={outfitId} name={name} weapon={profile?.weapon ?? null} element={element ?? profile?.defaultSignature ?? null} className={className} />
}

function partyLevel(preset: RpgPresetSaveV1, profiles: ReadonlyMap<string, RpgProfile>): number | null {
  const levels = preset.slots.flatMap((slot) => { const p = slot && profiles.get(slot.outfitId); return p ? [rpgMemberLevel(p)] : [] })
  return levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null
}
const isFull = (preset: RpgPresetSaveV1) => preset.slots.every((slot) => slot !== null)

// --- Parties ---------------------------------------------------------------------------------------------------------

export function RpgHubScreen() {
  const { content, account, release, retryRelease, chapters } = useRpg()
  const owned = useGame((state) => state.umas)
  const profiles = rpgOutfitProfiles(account)
  const name = (id: string) => content.umas.byId.get(id)?.name ?? id
  return <RpgFrame back="/" backLabel="Home" eyebrow="Global Uma RPG" title="Parties">
    <RpgTabs />
    {release?.status === 'unavailable' && <RpgCard className="mt-3"><p role="status" className="text-sm">Campaign unavailable</p>
      <p className="mt-1 text-xs text-ink-on-dark-soft">{release.reason}</p><GhostButton className="mt-2 w-full" onClick={retryRelease}>Retry</GhostButton></RpgCard>}
    {account.outfits.size === 0 && <RpgCard className="mt-3"><p className="text-sm">Start by enrolling Umas in the Roster. Any Uma with an A running style can join.</p>
      <Link to="/rpg/roster" className="mt-2 flex min-h-11 items-center justify-center rounded-sm bg-accent text-sm font-semibold text-ink">Open Roster</Link></RpgCard>}
    <div className="mt-3 space-y-3">{account.presets.map(({ id, data: preset }) => {
      const level = partyLevel(preset, profiles)
      const run = account.runs.find((r) => r.data.presetId === id && r.data.chapterId === preset.foregroundChapterId)?.data
      const chapter = chapters?.find((c) => c.id === preset.foregroundChapterId)
      const fights = chapter?.nodes.filter((n) => n.kind !== 'camp') ?? []
      const cleared = run ? fights.filter((n) => (run.wins[n.id] ?? 0) > 0).length : 0
      const ready = isFull(preset)
      return <article key={id} className="rounded-md border border-hairline-dark bg-stage-soft p-3">
        <div className="flex items-center justify-between gap-2">
          <Link to={ready ? `/rpg/party/${id}` : `/rpg/party/${id}/edit`} className="flex min-h-11 min-w-0 flex-1 items-center">
            <span className="min-w-0"><span className="block truncate font-display text-[17px]">{preset.name}</span>
              <span className="block text-[11px] text-ink-on-dark-soft">{ready ? `${level ? formatRpgLevel(level) : ''}${chapter ? ` · ${chapter.title} ${cleared}/${fights.length}` : ' · Choose a chapter'}` : `${preset.slots.filter(Boolean).length}/${RPG_PARTY_SIZE} · fill every slot`}</span></span>
          </Link>
          <Link to={`/rpg/party/${id}/edit`} aria-label={`Edit ${preset.name}`} className="flex min-h-11 items-center rounded-sm border border-hairline-dark px-3 text-[12px] font-semibold">Edit</Link>
        </div>
        <Link to={ready ? `/rpg/party/${id}` : `/rpg/party/${id}/edit`} className="mt-2 grid grid-cols-5 gap-1.5" aria-label={`${preset.name} members`}>
          {preset.slots.map((slot, i) => slot && owned[slot.outfitId]
            ? <OutfitIcon key={i} content={content} outfitId={slot.outfitId} name={name(slot.outfitId)} profile={profiles.get(slot.outfitId)} element={slot.signature} />
            : <span key={i} className="flex aspect-square items-center justify-center rounded-md border border-dashed border-hairline-dark text-lg text-ink-on-dark-soft">+</span>)}
        </Link>
      </article>
    })}</div>
  </RpgFrame>
}

// --- Roster and profile ----------------------------------------------------------------------------------------------

export function RpgRosterScreen() {
  const { content, account } = useRpg()
  const owned = useGame((state) => state.umas)
  const name = (id: string) => content.umas.byId.get(id)?.name ?? id
  const ids = orderRpgRoster(Object.keys(owned), new Set(account.outfits.keys()), name)
  return <RpgFrame back="/" backLabel="Home" eyebrow="Global Uma RPG" title="Roster" guide="class">
    <RpgTabs />
    {[true, false].map((enrolled) => {
      const group = ids.filter((id) => account.outfits.has(id) === enrolled)
      if (!group.length) return null
      return <section key={String(enrolled)} className="mt-4" aria-label={enrolled ? 'Enrolled' : 'Not enrolled'}>
        <h2 className="mb-2 text-[12px] font-semibold text-ink-on-dark-soft">{enrolled ? 'Enrolled' : 'Not enrolled'} · {group.length}</h2>
        <div className="grid grid-cols-5 gap-x-1.5 gap-y-3">{group.map((id) => {
          const profile = account.outfits.get(id)?.data.profile
          const eligible = STRATEGIES.some((s) => content.umas.byId.get(id)?.aptitudes.strategy[s] === 'A')
          return <Link key={id} to={`/rpg/roster/${encodeURIComponent(id)}`} className="block min-w-0" aria-label={`${name(id)} · ${profile ? formatRpgLevel(rpgMemberLevel(profile)) : eligible ? 'Enroll' : 'Not eligible'}`}>
            <OutfitIcon content={content} outfitId={id} name={name(id)} profile={profile} />
            <span className="mt-1 block truncate text-center text-[11px] font-semibold">{name(id)}</span>
            <span className="block text-center text-[10px] text-ink-on-dark-soft">{profile ? formatRpgLevel(rpgMemberLevel(profile)) : eligible ? 'Enroll' : '—'}</span>
          </Link>
        })}</div>
      </section>
    })}
  </RpgFrame>
}

export function RpgProfileScreen() {
  const { outfitId = '' } = useParams()
  const { content, account } = useRpg()
  const owned = useGame((state) => state.umas)
  const template = content.umas.byId.get(outfitId)
  const profile = account.outfits.get(outfitId)?.data.profile ?? null
  if (!owned[outfitId] || !template) return <ScreenState title="Outfit unavailable" detail="This profile needs an owned outfit." action={{ label: 'Roster', to: '/rpg/roster' }} />
  return <RpgFrame back="/rpg/roster" backLabel="Roster" eyebrow={template.outfit ?? 'Uma RPG'} title={template.name} guide="class">
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <OutfitIcon content={content} outfitId={outfitId} name={template.name} profile={profile} className="aspect-square w-24" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{profile ? `${title(profile.style)} · ${RPG_WEAPON_LABELS[profile.weapon]}` : 'Not enrolled'}</p>
        {profile && <><p className="mt-0.5 text-[12px] text-ink-on-dark-soft">{formatRpgLevel(rpgMemberLevel(profile))}{profile.level < RPG_TIER_MAX_LEVEL ? ` · ${profile.exp}/${rpgExpToNext(profile.level)} EXP` : ` · ${profile.exp} EXP banked`}</p>
          {profile.level < RPG_TIER_MAX_LEVEL && <RpgBar className="mt-1" value={profile.exp} max={rpgExpToNext(profile.level)} tone="exp" />}</>}
        <p className="mt-1 flex flex-wrap gap-2">{RPG_ELEMENTS.filter((e) => rpgAffinities(template.aptitudes)[e]).map((e) => <span key={e} className="flex items-center gap-0.5 text-[11px]"><ElementMark element={e} />{rpgAffinities(template.aptitudes)[e]}</span>)}</p>
      </div>
    </div>
    {profile ? <ProfileProgress outfitId={outfitId} profile={profile} /> : <Enroll outfitId={outfitId} />}
  </RpgFrame>
}

function Enroll({ outfitId }: { outfitId: string }) {
  const { content } = useRpg()
  const template = content.umas.byId.get(outfitId)!
  const styles = STRATEGIES.filter((s) => template.aptitudes.strategy[s] === 'A')
  const elements = RPG_ELEMENTS.filter((e) => rpgAffinities(template.aptitudes)[e])
  const [style, setStyle] = useState<Strategy | undefined>(styles[0])
  const weapons = style ? rpgWeaponsForStyle(style) : []
  const [weapon, setWeapon] = useState<RpgWeapon | undefined>(weapons[0])
  const [signature, setSignature] = useState<RpgElement | undefined>(elements.find((e) => rpgAffinities(template.aptitudes)[e] === 'A') ?? elements[0])
  const [busy, setBusy] = useState(false)
  if (!styles.length) return <RpgCard className="mt-4"><p className="text-sm">No A running style, so this Uma can't join the RPG. She stays usable everywhere else.</p></RpgCard>
  const chosenWeapon = weapon && weapons.includes(weapon) ? weapon : weapons[0]!
  return <RpgCard className="mt-4 space-y-3">
    <p className="text-[12px] text-ink-on-dark-soft">Class and weapon can change freely until she reaches Lv2.</p>
    <RpgSelect label="Class (A running style)" value={style!} options={styles.map((s) => ({ value: s, label: title(s) }))} onChange={(s) => { setStyle(s); setWeapon(rpgWeaponsForStyle(s)[0]) }} />
    <RpgSelect label="Weapon" value={chosenWeapon} options={weapons.map((w) => ({ value: w, label: RPG_WEAPON_LABELS[w] }))} onChange={setWeapon} />
    <RpgSelect label="Signature element" value={signature!} options={elements.map((e) => ({ value: e, label: `${title(e)} · ${rpgAffinities(template.aptitudes)[e]}` }))} onChange={setSignature} />
    <PrimaryButton disabled={busy} onClick={() => { setBusy(true); void commit(() => enrollRpgOutfit({ template, contentVersion: content.manifest.version, style: style!, weapon: chosenWeapon, signature: signature! })).finally(() => setBusy(false)) }}>Enroll {template.name}</PrimaryButton>
  </RpgCard>
}

function ProfileProgress({ outfitId, profile }: { outfitId: string; profile: RpgProfile }) {
  const stats = projectRpgStats(profile)
  const points = rpgTreePointsEarned(profile.level) - rpgTreePointsSpent(profile.tree)
  const [busy, setBusy] = useState(false)
  const run = (op: () => Promise<unknown>) => { setBusy(true); void commit(op).finally(() => setBusy(false)) }
  const cells = eligibleRpgCells(profile)
  const branches = RPG_BRANCHES.flatMap((list, index) => list.map((branch) => [index + 1, branch] as [number, RpgSkillRef['branch']]))
  return <div className="mt-4 space-y-3">
    <RpgCard><div className="grid grid-cols-3 gap-2 text-center text-[11px]">
      {([['ATK', stats.atk], ['HP', stats.hp], ['MP', stats.mp], ['DEF', stats.pdef], ['M.DEF', stats.mdef], ['Speed', stats.initiative]] as const).map(([label, value]) =>
        <p key={label}><span className="block text-ink-on-dark-soft">{label}</span><span className="text-[15px] font-semibold">{value}</span></p>)}
    </div></RpgCard>
    {canChangeRpgClass(profile) && <ClassEdit outfitId={outfitId} profile={profile} />}
    <section aria-label="Skills">
      <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Skills</h2><span className="text-[12px] text-accent">{points} point{points === 1 ? '' : 's'} to spend</span></div>
      <p className="mt-0.5 text-[11px] text-ink-on-dark-soft">Two points a level up to Lv45 (90 a tier): learn a skill, then raise any skill to Lv5. Depths open at Lv{RPG_DEPTH_GATES.join('/')}; B elements stop at depth {RPG_B_MAX_DEPTH}. Equip skills from the party screen.</p>
      <div className="mt-2 space-y-2">{cells.map((cell) => <RpgCard key={cell.element}>
        <p className="flex items-center gap-1 text-[13px] font-semibold"><ElementMark element={cell.element} label />· {cell.affinity}</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">{branches.filter(([depth]) => depth <= cell.maxDepth).map(([depth, branch]) => {
          const ref: RpgSkillRef = { tier: profile.tier, weapon: profile.weapon, element: cell.element, depth, branch }
          const learned = profile.tree.find((s) => rpgSkillKey(s) === rpgSkillKey(ref))
          const gate = profile.level < RPG_DEPTH_GATES[depth - 1]!
          const prior = depth === 1 || profile.tree.some((s) => s.element === cell.element && s.depth === depth - 1)
          const canLearn = points > 0 && !gate && prior && (!learned || learned.level < 5)
          return <button key={branch} type="button" disabled={busy || !canLearn} onClick={() => run(() => learnRpgSkill(outfitId, ref))}
            className={`min-h-14 rounded-sm border px-2 py-1 text-left text-[11px] disabled:opacity-60 ${learned ? 'border-accent bg-accent/10' : 'border-hairline-dark'}`}>
            <span className="block font-semibold">{battleSkillLabel(ref)}{learned ? ` · Lv${learned.level}` : ''}</span>
            <span className="block text-ink-on-dark-soft">{gate ? `Opens Lv${RPG_DEPTH_GATES[depth - 1]}` : !prior ? 'Needs the depth above' : `${battleSkillMp(ref)} MP · ${skillReach(branch)}`}</span>
            {canLearn && <span className="block text-accent">{learned ? 'Level up · 1 pt' : 'Learn · 1 pt'}</span>}
          </button>
        })}</div>
      </RpgCard>)}</div>
    </section>
    {profile.level === RPG_TIER_MAX_LEVEL && <RpgCard><p className="text-sm font-semibold">Promote to Tier {profile.tier + 1}</p>
      <p className="mt-1 text-[12px] text-ink-on-dark-soft">Stats and banked EXP carry over; this tier's skills are archived (none kept as legacy here).</p>
      <PrimaryButton className="mt-2" disabled={busy} onClick={() => run(() => promoteRpgOutfitTier(outfitId, [], true))}>Promote</PrimaryButton></RpgCard>}
  </div>
}

function ClassEdit({ outfitId, profile }: { outfitId: string; profile: RpgProfile }) {
  const styles = STRATEGIES.filter((s) => profile.sourceAptitudes.strategy[s] === 'A')
  const options = styles.flatMap((style) => rpgWeaponsForStyle(style).map((weapon) => ({ value: `${style}:${weapon}`, label: `${title(style)} · ${RPG_WEAPON_LABELS[weapon]}` })))
  if (options.length < 2) return null
  return <RpgSelect label="Class (free to change until Lv2)" value={`${profile.style}:${profile.weapon}`} options={options}
    onChange={(value) => { const [style, weapon] = value.split(':') as [Strategy, RpgWeapon]; void commit(() => changeRpgOutfitClass(outfitId, style, weapon)) }} />
}

// --- Party editor ----------------------------------------------------------------------------------------------------

export function RpgPartyEditScreen() {
  const { presetId = '' } = useParams()
  const { content, account } = useRpg()
  const owned = useGame((state) => state.umas)
  const row = account.presets.find((p) => p.id === presetId)
  const [name, setName] = useState(row?.data.name ?? '')
  useEffect(() => { setName(row?.data.name ?? '') }, [row?.data.name])
  if (!row) return <ScreenState title="Party unavailable" detail="Choose one of the five parties." action={{ label: 'Parties', to: '/rpg' }} />
  const preset = row.data
  const profiles = rpgOutfitProfiles(account)
  const label = (id: string) => content.umas.byId.get(id)?.name ?? id
  const save = (next: RpgPresetSaveV1) => void commit(() => saveRpgParty(next))
  const setSlot = (index: number, outfitId: string) => {
    const profile = profiles.get(outfitId)
    const slots = [...preset.slots] as RpgPresetSaveV1['slots']
    slots[index] = profile ? { outfitId, signature: profile.defaultSignature, loadout: [] } : null
    save({ ...preset, slots })
  }
  // Every other party gives up a member that moves here; the picker lists all enrolled Umas.
  const enrolled = [...account.outfits.keys()].filter((id) => owned[id]).sort((a, b) => label(a).localeCompare(label(b)))
  return <RpgFrame back={isFull(preset) ? `/rpg/party/${presetId}` : '/rpg'} backLabel="Back" eyebrow="Edit party" title={preset.name} guide="party">
    <label className="block text-[11px] font-semibold text-ink-on-dark-soft">Name
      <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== preset.name) save({ ...preset, name: name.trim() }) }}
        className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage px-3 text-[15px] text-ink-on-dark" />
    </label>
    {enrolled.length === 0 && <RpgCard className="mt-3"><p className="text-sm">Enroll Umas in the Roster first.</p><Link to="/rpg/roster" className="mt-2 flex min-h-11 items-center text-accent">Open Roster</Link></RpgCard>}
    <div className="mt-3 space-y-2">{preset.slots.map((slot, index) => {
      const profile = slot ? profiles.get(slot.outfitId) : null
      const other = (id: string) => account.presets.find((p) => p.id !== presetId && p.data.slots.some((s) => s?.outfitId === id))?.data.name
      const options = [{ value: '', label: 'Empty' }, ...enrolled.filter((id) => id === slot?.outfitId || !preset.slots.some((s) => s?.outfitId === id))
        .map((id) => ({ value: id, label: `${label(id)} · ${formatRpgLevel(rpgMemberLevel(profiles.get(id)!))}${other(id) ? ` · in ${other(id)}` : ''}` }))]
      return <RpgCard key={index}>
        <div className="grid grid-cols-[56px_1fr] gap-3">
          {slot && profile ? <OutfitIcon content={content} outfitId={slot.outfitId} name={label(slot.outfitId)} profile={profile} element={slot.signature} className="aspect-square w-14" />
            : <span className="flex aspect-square w-14 items-center justify-center rounded-md border border-dashed border-hairline-dark text-lg text-ink-on-dark-soft">{index + 1}</span>}
          <RpgSelect label={`Slot ${index + 1}`} value={slot?.outfitId ?? ''} options={options} onChange={(id) => setSlot(index, id)} />
        </div>
        {slot && profile && <SlotLoadout presetId={presetId} profile={profile} signature={slot.signature} loadout={slot.loadout} />}
      </RpgCard>
    })}</div>
    {isFull(preset) && <Link to={`/rpg/party/${presetId}`} className="mt-4 flex min-h-12 items-center justify-center rounded-sm bg-accent text-[15px] font-semibold text-ink">Choose a chapter</Link>}
  </RpgFrame>
}

function SlotLoadout({ presetId, profile, signature, loadout }: { presetId: string; profile: RpgProfile; signature: RpgElement; loadout: readonly RpgSkillRef[] }) {
  const learned = [...profile.tree, ...profile.legacy]
  const slots = rpgActiveSlots(profile.level)
  const keys = new Set(loadout.map(rpgSkillKey))
  const toggle = (ref: RpgSkillRef) => {
    const next = keys.has(rpgSkillKey(ref)) ? loadout.filter((r) => rpgSkillKey(r) !== rpgSkillKey(ref)) : [...loadout, ref]
    if (next.length > slots) { pushToast(`${slots} skill slots at this level`); return }
    void commit(() => equipRpgSkills(presetId, profile.outfitId, signature, next))
  }
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]"><span className="text-ink-on-dark-soft">Signature</span>
      {RPG_ELEMENTS.filter((e) => canUseRpgSignature(profile, e)).map((e) => <button key={e} type="button" aria-pressed={e === signature}
        onClick={() => { if (e !== signature) void commit(() => equipRpgSkills(presetId, profile.outfitId, e, loadout)) }}
        className={`flex min-h-9 items-center rounded-full border px-2 ${e === signature ? 'border-accent bg-accent/15' : 'border-hairline-dark'}`}><ElementMark element={e} label /></button>)}
    </div>
    {learned.length === 0 ? <p className="text-[11px] text-ink-on-dark-soft">No skills learned yet: spend her points on her profile.</p>
      : <div className="flex flex-wrap gap-1.5" aria-label={`Skills, ${loadout.length} of ${slots} equipped`}>{learned.map((skill) => {
        const on = keys.has(rpgSkillKey(skill))
        return <button key={rpgSkillKey(skill)} type="button" aria-pressed={on} onClick={() => toggle(skill)}
          className={`flex min-h-9 items-center gap-1 rounded-full border px-2 text-[11px] ${on ? 'border-accent bg-accent/15 text-ink-on-dark' : 'border-hairline-dark text-ink-on-dark-soft'}`}>
          <IdentityGlyph element={skill.element} />{battleSkillLabel(skill)} {skill.level > 1 ? `Lv${skill.level}` : ''}</button>
      })}<span className="self-center text-[10px] text-ink-on-dark-soft">{loadout.length}/{slots}</span></div>}
  </div>
}

// --- Launch pad ------------------------------------------------------------------------------------------------------

export function RpgLaunchScreen() {
  const { presetId = '' } = useParams()
  const { content, account, chapters, release, retryRelease } = useRpg()
  const navigate = useNavigate()
  const row = account.presets.find((p) => p.id === presetId)
  if (!row) return <ScreenState title="Party unavailable" detail="Choose one of the five parties." action={{ label: 'Parties', to: '/rpg' }} />
  const preset = row.data
  const profiles = rpgOutfitProfiles(account)
  const level = partyLevel(preset, profiles)
  const label = (id: string) => content.umas.byId.get(id)?.name ?? id
  return <RpgFrame back="/rpg" backLabel="Parties" eyebrow={preset.name} title="Chapters" guide="map"
    trailing={<Link to={`/rpg/party/${presetId}/edit`} className="flex min-h-11 items-center rounded-sm border border-hairline-dark bg-stage-soft px-3 text-[12px] font-semibold">Edit</Link>}>
    <Link to={`/rpg/party/${presetId}/edit`} className="grid grid-cols-5 gap-1.5" aria-label="Party members">
      {preset.slots.map((slot, i) => slot ? <OutfitIcon key={i} content={content} outfitId={slot.outfitId} name={label(slot.outfitId)} profile={profiles.get(slot.outfitId)} element={slot.signature} />
        : <span key={i} className="flex aspect-square items-center justify-center rounded-md border border-dashed border-hairline-dark">+</span>)}
    </Link>
    <p className="mt-1 text-[11px] text-ink-on-dark-soft">{level ? `Party ${formatRpgLevel(level)}` : ''}</p>
    {!isFull(preset) && <RpgCard className="mt-3"><p className="text-sm">Fill all five slots to enter a chapter.</p></RpgCard>}
    {release?.status === 'unavailable' && <RpgCard className="mt-3"><p className="text-sm">{release.reason}</p><GhostButton className="mt-2 w-full" onClick={retryRelease}>Retry</GhostButton></RpgCard>}
    {!chapters && release?.status !== 'unavailable' && <p role="status" className="mt-4 text-sm text-ink-on-dark-soft">Loading the campaign…</p>}
    <ol className="mt-3 space-y-2">{chapters?.map((chapter) => {
      const run = account.runs.find((r) => r.id === rpgRunId(presetId, chapter.id))?.data ?? null
      const fights = chapter.nodes.filter((n) => n.kind !== 'camp')
      const cleared = fights.filter((n) => rpgNodeStatus(chapter, run, n.id) === 'cleared').length
      const done = rpgChapterCleared(chapter, run)
      const end = chapter.levelStart + 9
      const crest = getContentAsset(content, 'scenario-icons', chapter.scenarioId)
      const behind = level !== null && level < chapter.levelStart - 1
      return <li key={chapter.id}>
        <button type="button" disabled={!isFull(preset)} onClick={() => navigate(`/rpg/party/${presetId}/${chapter.id}`)}
          className={`grid w-full grid-cols-[52px_1fr_auto] items-center gap-3 rounded-md border p-2 text-left disabled:opacity-60 ${preset.foregroundChapterId === chapter.id ? 'border-accent bg-accent/10' : 'border-hairline-dark bg-stage-soft'}`}>
          <span className="flex h-13 w-13 items-center justify-center overflow-hidden rounded-sm bg-white/5">
            <AtlasSprite asset={crest} alt="" decorative className="h-full w-full object-contain" fallback={<span className="text-[15px] font-bold text-accent">{chapter.tier}</span>} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold tracking-[0.14em] text-accent uppercase">Chapter {chapter.tier}</span>
            <span className="block truncate text-[15px] font-semibold">{chapter.title}</span>
            <span className="block text-[11px] text-ink-on-dark-soft">{formatRpgBand(chapter.levelStart, end)}{behind ? ' · above your level' : ''}</span>
            {cleared > 0 && <RpgBar className="mt-1" value={cleared} max={fights.length} tone="exp" />}
          </span>
          <span className="text-right text-[11px] text-ink-on-dark-soft">{done ? <span className="text-accent">Cleared</span> : cleared ? `${cleared}/${fights.length}` : ''}</span>
        </button>
      </li>
    })}</ol>
  </RpgFrame>
}

