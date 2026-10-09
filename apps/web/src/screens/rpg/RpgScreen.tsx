// Uma RPG: parties, roster, profiles, class trees and the launch pad (docs/design/uma-rpg-classes.md, D263, D277–D280).
// Every screen shares one frame: back, title and the guide. Changes save at once; there is no Save or Sync step.
import {
  RPG_CLASS_WEAPONS, RPG_PARTY_SIZE, RPG_TIER_MAX_LEVEL, RPG_VARIANTS_PER_TREE, RPG_WEAPON_KINDS, canChangeRpgClass, projectRpgStats,
  rpgActiveSlots, rpgCampaign, rpgChapterCleared, rpgClassOptions, rpgExpToNext, rpgHand, rpgLearnBlock, rpgLearnedSkills, rpgMemberLevel,
  rpgNode, rpgNodeKey, rpgNodeStatus, rpgProfileTrees, rpgRunId, rpgTreeBranches, rpgTreeNodes, rpgTreePointsEarned, rpgTreePointsSpent,
  RPG_CHAPTER_LEVELS, RPG_DEPTH_GATES,
  type RpgCampaignChapter, type RpgClass, type RpgDamageKind, type RpgNode, type RpgNodeRef, type RpgPresetSave, type RpgPresetSlot,
  type RpgProfile, type RpgSkillDef, type RpgTreeId, type RpgWeapon,
} from '@racer/domain'
import { liveQuery } from 'dexie'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Outlet, useNavigate, useParams, useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { getContentAsset, type LoadedContent } from '../../content/runtime'
import type { RpgRelease } from '../../content/rpg-release'
import { changeRpgOutfitClass, enrollRpgOutfit, forgetRpgSkill, learnRpgSkill, promoteRpgOutfitTier, readRpgAccount, rpgOutfitProfiles,
  saveRpgParty, equipRpgSkills, type RpgAccount } from '../../game/rpg-local'
import { gameRuntime } from '../../game/runtime'
import { useGame } from '../../game/store'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { ScreenState } from '../../ui/ScreenState'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
import { RPG_WEAPON_LABELS, RpgPortrait, WeaponPair } from '../../ui/rpg/RpgPortrait'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { ChevronRightIcon } from '../../ui/icons'
import { orderRpgRoster, rpgPartyCandidates } from '../../ui/rpg/roster-options'
import { CLASS_LABEL, GhostButton, KindMark, PrimaryButton, RpgBar, RpgCard, RpgSelect, RpgTabs, WEAPON_KIND_LABEL, WeaponKindMark,
  formatRpgBand, formatRpgLevel } from '../../ui/rpg/rpg-ui'
import { RpgGuide, rpgGuideMemory, type RpgGuidePage } from './RpgGuide'
import { useRpgRelease } from './useRpgRelease'

export interface RpgContextValue {
  content: LoadedContent
  account: RpgAccount
  release: RpgRelease | null
  retryRelease: () => void
  chapters: RpgCampaignChapter[] | null
  openGuide: (page?: RpgGuidePage) => void
}
/** Exported for screen tests; the shell provides it. */
export const RpgContext = createContext<RpgContextValue | null>(null)
export function useRpg(): RpgContextValue {
  const value = useContext(RpgContext)
  if (!value) throw new Error('RPG screen must be inside its shell')
  return value
}

const title = (value: string) => value[0]!.toUpperCase() + value.slice(1)
export const pushToast = (message: string) => useGame.getState().pushToast(message)
export const weaponsLabel = (weapons: readonly RpgWeapon[]): string => weapons.map((w) => RPG_WEAPON_LABELS[w]).join(' + ')
export const CLASS_BLURB: Readonly<Record<RpgClass, string>> = {
  brawler: 'One heavy action a turn with either weapon: weapon damage with an elemental splash.',
  mage: 'Pure magic: two staves cast twice a turn, or one staff with a Short Sword that follows every spell.',
  cleric: 'Light, Dark and Ultima casts that carry buffs, debuffs, barriers and heals.',
  summoner: 'Two half-strength summons a turn of every damage kind, plus a free Familiar.',
}
export const TREE_LABEL: Readonly<Record<RpgTreeId, string>> = {
  greatsword: 'Greatsword', spear: 'Spear', axe: 'Axe', bow: 'Bow', 'mage-staff': 'Mage Staff', 'arcane-staff': 'Arcane Staff',
  'short-sword': 'Short Sword', 'cleric-staff': 'Cleric Staff', 'summon-elemental': 'Elemental summons', 'summon-arcane': 'Arcane summons',
}
const BRANCH_LABEL: Readonly<Record<string, string>> = {
  fire: 'Fire', ice: 'Ice', lightning: 'Lightning', light: 'Light', dark: 'Dark', ultima: 'Ultima', duel: 'Duel', melee: 'Melee',
  tempo: 'Tempo', grace: 'Grace', malice: 'Malice', sanctuary: 'Sanctuary', angels: 'Angels', demons: 'Demons', archons: 'Archons',
}
/** Distinct damage kinds a skill lands, in order. */
export const skillKinds = (skill: RpgSkillDef): RpgDamageKind[] =>
  [...new Set([...skill.hits, ...skill.focus ?? [], ...(skill.splash ? [skill.splash] : []), ...(skill.sweep ? [skill.sweep] : [])].flatMap((h) => h.parts.map((p) => p.kind)))]
/** A skill as this Uma casts it: targets, hits, power after her hand, and MP. */
export function skillLine(profile: Pick<RpgProfile, 'classId' | 'weapons' | 'tier'>, skill: RpgSkillDef): string {
  const hand = rpgHand(profile)
  const per = skill.target === 'all' ? 'every foe' : skill.target === 'random' ? 'random foes' : 'one foe'
  const total = skill.hits.reduce((sum, h) => sum + h.power, 0) * hand.power
  const mp = Math.max(1, Math.round(skill.mp * hand.mp)) * profile.tier
  return `${per} · ${skill.hits.length} hit${skill.hits.length === 1 ? '' : 's'} · ${total.toFixed(1)}× · ${mp} MP`
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

function OutfitIcon({ content, outfitId, name, profile, className = 'aspect-square w-full' }: {
  content: LoadedContent; outfitId: string; name: string; profile?: RpgProfile | null; className?: string
}) {
  return <RpgPortrait content={content} compact artwork="icon" outfitId={outfitId} name={name} weapons={profile?.weapons ?? []} className={className} />
}

function partyLevel(preset: RpgPresetSave, profiles: ReadonlyMap<string, RpgProfile>): number | null {
  const levels = preset.slots.flatMap((slot) => { const p = slot && profiles.get(slot.outfitId); return p ? [rpgMemberLevel(p)] : [] })
  return levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null
}
const isFull = (preset: RpgPresetSave) => preset.slots.every((slot) => slot !== null)

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
            ? <OutfitIcon key={i} content={content} outfitId={slot.outfitId} name={name(slot.outfitId)} profile={profiles.get(slot.outfitId)} />
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
  const levelOf = (id: string) => { const p = account.outfits.get(id)?.data.profile; return p ? rpgMemberLevel(p) : null }
  const ids = orderRpgRoster(Object.keys(owned), levelOf, name)
  return <RpgFrame back="/" backLabel="Home" eyebrow="Global Uma RPG" title="Roster" guide="class">
    <RpgTabs />
    {[true, false].map((enrolled) => {
      const group = ids.filter((id) => account.outfits.has(id) === enrolled)
      if (!group.length) return null
      return <section key={String(enrolled)} className="mt-4" aria-label={enrolled ? 'Enrolled' : 'Not enrolled'}>
        <h2 className="mb-2 text-[12px] font-semibold text-ink-on-dark-soft">{enrolled ? 'Enrolled' : 'Not enrolled'} · {group.length}</h2>
        <div className="grid grid-cols-5 gap-x-1.5 gap-y-3">{group.map((id) => {
          const profile = account.outfits.get(id)?.data.profile
          const template = content.umas.byId.get(id)
          const eligible = !!template && rpgClassOptions(template.aptitudes).length > 0
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
  const [search] = useSearchParams()
  const { content, account } = useRpg()
  const owned = useGame((state) => state.umas)
  const template = content.umas.byId.get(outfitId)
  const profile = account.outfits.get(outfitId)?.data.profile ?? null
  const label = (id: string) => content.umas.byId.get(id)?.name ?? id
  // Opened from a party: back returns to it, and its members are one tap apart.
  const partyId = search.get('party')
  const party = partyId ? account.presets.find((p) => p.id === partyId) : undefined
  const members = party ? party.data.slots.flatMap((slot) => slot && account.outfits.has(slot.outfitId) ? [slot.outfitId] : []) : []
  const inParty = !!party && members.includes(outfitId)
  if (!owned[outfitId] || !template) return <ScreenState title="Outfit unavailable" detail="This profile needs an owned outfit." action={{ label: 'Roster', to: '/rpg/roster' }} />
  return <RpgFrame back={inParty ? `/rpg/party/${partyId}/edit` : '/rpg/roster'} backLabel={inParty ? party.data.name : 'Roster'}
    eyebrow={inParty ? party.data.name : template.outfit ?? 'Uma RPG'} title={template.name} guide="class">
    {inParty && <nav aria-label={`${party.data.name} members`} className="mb-3 grid grid-cols-5 gap-1.5">{members.map((id) =>
      <Link key={id} to={`/rpg/roster/${encodeURIComponent(id)}?party=${partyId}`} aria-current={id === outfitId ? 'page' : undefined} aria-label={`${label(id)}'s skill trees`}
        className={`block rounded-md ${id === outfitId ? 'ring-2 ring-accent' : 'opacity-60'}`}>
        <OutfitIcon content={content} outfitId={id} name={label(id)} profile={account.outfits.get(id)?.data.profile} />
      </Link>)}</nav>}
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <OutfitIcon content={content} outfitId={outfitId} name={template.name} profile={profile} className="aspect-square w-24" />
      <div className="min-w-0">
        {profile ? <>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold">{CLASS_LABEL[profile.classId]}<WeaponPair weapons={profile.weapons} size={20} /></p>
          <p className="text-[11px] text-ink-on-dark-soft">{weaponsLabel(profile.weapons)}</p>
        </> : <p className="text-[13px] font-semibold">Not enrolled</p>}
        {profile && <><p className="mt-0.5 text-[12px] text-ink-on-dark-soft">{formatRpgLevel(rpgMemberLevel(profile))}{profile.level < RPG_TIER_MAX_LEVEL ? ` · ${profile.exp}/${rpgExpToNext(profile.level)} EXP` : ` · ${profile.exp} EXP banked`}</p>
          {profile.level < RPG_TIER_MAX_LEVEL && <RpgBar className="mt-1" value={profile.exp} max={rpgExpToNext(profile.level)} tone="exp" />}</>}
        {!profile && <p className="mt-1 text-[11px] text-ink-on-dark-soft">{rpgClassOptions(template.aptitudes).map((c) => CLASS_LABEL[c]).join(' or ') || 'No class: needs an A running style'}</p>}
      </div>
    </div>
    {profile ? <ProfileProgress outfitId={outfitId} profile={profile} /> : <Enroll outfitId={outfitId} />}
  </RpgFrame>
}

function Enroll({ outfitId }: { outfitId: string }) {
  const { content } = useRpg()
  const template = content.umas.byId.get(outfitId)!
  const classes = rpgClassOptions(template.aptitudes)
  const [chosen, setChosen] = useState<RpgClass | undefined>(classes[0])
  const [setIndex, setSetIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  if (!chosen) return <RpgCard className="mt-4"><p className="text-sm">No A running style, so this Uma can't join the RPG. She stays usable everywhere else.</p></RpgCard>
  const classId = classes.includes(chosen) ? chosen : classes[0]!
  const sets = RPG_CLASS_WEAPONS[classId]
  const weapons = sets[Math.min(setIndex, sets.length - 1)]!
  return <RpgCard className="mt-4 space-y-3">
    <p className="text-[12px] text-ink-on-dark-soft">Her running styles make her a {classes.map((c) => CLASS_LABEL[c]).join(' or ')}. Class and weapons can change freely until she learns a skill.</p>
    {classes.length > 1 && <RpgSelect label="Class" value={classId} options={classes.map((c) => ({ value: c, label: CLASS_LABEL[c] }))} onChange={(c) => { setChosen(c); setSetIndex(0) }} />}
    <p className="text-[13px]"><b>{CLASS_LABEL[classId]}</b> · {CLASS_BLURB[classId]}</p>
    {sets.length > 1 && <RpgSelect label="Weapons" value={String(Math.min(setIndex, sets.length - 1))} options={sets.map((set, i) => ({ value: String(i), label: weaponsLabel(set) }))} onChange={(v) => setSetIndex(Number(v))} />}
    <PrimaryButton disabled={busy} onClick={() => { setBusy(true); void commit(() => enrollRpgOutfit({ template, contentVersion: content.manifest.version, classId, weapons: [...weapons] })).finally(() => setBusy(false)) }}>Enroll {template.name}</PrimaryButton>
  </RpgCard>
}

export function ProfileProgress({ outfitId, profile }: { outfitId: string; profile: RpgProfile }) {
  const stats = projectRpgStats(profile)
  const points = rpgTreePointsEarned(profile.level) - rpgTreePointsSpent(profile.tree)
  const trees = rpgProfileTrees(profile)
  const [treeIndex, setTreeIndex] = useState(0)
  const tree = trees[Math.min(treeIndex, trees.length - 1)]!
  const branches = rpgTreeBranches(tree)
  const [picked, setPicked] = useState<string | null>(null)
  const branch = picked && branches.includes(picked) ? picked : branches[0]!
  const [busy, setBusy] = useState(false)
  const run = (op: () => Promise<unknown>) => { setBusy(true); void commit(op).finally(() => setBusy(false)) }
  const learned = new Set(profile.tree.map((r) => r.id))
  const variants = profile.tree.filter((r) => { const n = rpgNode(r.id); return n?.tree === tree && n.variant !== null }).length
  const nodes = rpgTreeNodes(tree).filter((n) => n.branch === branch)
  const tab = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center rounded-xs px-2 text-[12px] font-semibold ${on ? 'bg-accent text-ink' : 'text-ink-on-dark-soft'}`
  return <div className="mt-4 space-y-3">
    <RpgCard><div className="grid grid-cols-3 gap-2 text-center text-[11px]">
      {([['ATK', stats.atk], ['M.ATK', stats.matk], ['HP', stats.hp], ['MP', stats.mp], ['DEF', stats.pdef], ['M.DEF', stats.mdef]] as const).map(([label, value]) =>
        <p key={label}><span className="block text-ink-on-dark-soft">{label}</span><span className="text-[15px] font-semibold">{value}</span></p>)}
    </div></RpgCard>
    {canChangeRpgClass(profile) && <ClassEdit outfitId={outfitId} profile={profile} />}
    <section aria-label="Skill trees">
      <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Skills</h2><span className="text-[12px] text-accent">{points} point{points === 1 ? '' : 's'} to spend</span></div>
      <p className="mt-0.5 text-[11px] text-ink-on-dark-soft">A skill costs its depth; depths open at Lv{RPG_DEPTH_GATES.join('/')} and every core skill fits by Lv40. Beside a core skill, a fork offers two variants: take one side, up to {RPG_VARIANTS_PER_TREE} per tree, and swap them any time. Equip skills on the party screen.</p>
      <div className="mt-2 flex gap-1 rounded-sm bg-stage-soft p-1" role="tablist" aria-label="Trees">
        {trees.map((t, i) => <button key={t} type="button" role="tab" aria-selected={t === tree} onClick={() => setTreeIndex(i)} className={tab(t === tree)}>{TREE_LABEL[t]}</button>)}
      </div>
      <div className="mt-1 flex gap-1 rounded-sm bg-stage-soft p-1" role="tablist" aria-label="Branches">
        {branches.map((b) => <button key={b} type="button" role="tab" aria-selected={b === branch} onClick={() => setPicked(b)} className={tab(b === branch)}>{BRANCH_LABEL[b] ?? b}</button>)}
      </div>
      <p className="mt-1 text-right text-[11px] text-ink-on-dark-soft">{TREE_LABEL[tree]} variants {variants}/{RPG_VARIANTS_PER_TREE}</p>
      <ol className="mt-1 space-y-2">{[1, 2, 3, 4, 5].map((depth) => {
        const core = nodes.find((n) => n.depth === depth && n.variant === null)!
        const forks = nodes.filter((n) => n.depth === depth && n.variant !== null)
        return <li key={depth} className="space-y-1">
          <NodeButton profile={profile} node={core} learned={learned.has(core.id)} busy={busy} onLearn={() => run(() => learnRpgSkill(outfitId, core.id))} />
          {forks.length > 0 && <div className="grid grid-cols-2 gap-1 pl-3" aria-label={`${core.name} variants`}>
            {forks.map((n) => <NodeButton key={n.id} profile={profile} node={n} learned={learned.has(n.id)} busy={busy} compact
              onLearn={() => run(() => learnRpgSkill(outfitId, n.id))} onForget={() => run(() => forgetRpgSkill(outfitId, n.id))} />)}
          </div>}
        </li>
      })}</ol>
    </section>
    {profile.level === RPG_TIER_MAX_LEVEL && <RpgCard><p className="text-sm font-semibold">Promote to Tier {profile.tier + 1}</p>
      <p className="mt-1 text-[12px] text-ink-on-dark-soft">Stats and banked EXP carry over; this tier's skills are archived (none kept as legacy here).</p>
      <PrimaryButton className="mt-2" disabled={busy} onClick={() => run(() => promoteRpgOutfitTier(outfitId, [], true))}>Promote</PrimaryButton></RpgCard>}
  </div>
}

function NodeButton({ profile, node, learned, busy, compact = false, onLearn, onForget }: {
  profile: RpgProfile; node: RpgNode; learned: boolean; busy: boolean; compact?: boolean; onLearn: () => void; onForget?: () => void
}) {
  const block = learned ? null : rpgLearnBlock(profile, node.id)
  const detail = node.skill ? skillLine(profile, node.skill) : node.summary
  const action = learned ? (onForget && node.variant ? 'Swap out · refund' : null) : block ? block : `Learn · ${node.cost} pt${node.cost === 1 ? '' : 's'}`
  return <button type="button" disabled={busy || (learned ? !onForget || !node.variant : !!block)} onClick={learned ? onForget : onLearn}
    aria-label={`${node.name}${node.variant ? ' (variant)' : ''}, ${learned ? 'learned' : block ?? 'can learn'}`}
    className={`flex w-full flex-col rounded-sm border px-2 py-1.5 text-left disabled:opacity-70 ${compact ? 'min-h-16 text-[10px]' : 'min-h-14 text-[11px]'} ${learned ? 'border-accent bg-accent/10' : 'border-hairline-dark'}`}>
    <span className="flex items-center gap-1 font-semibold">{node.skill && skillKinds(node.skill).map((k) => <KindMark key={k} kind={k} />)}<span className="truncate">{node.name}</span>
      {!compact && <span className="ml-auto text-[10px] font-normal text-ink-on-dark-soft">D{node.depth}</span>}</span>
    <span className="block text-ink-on-dark-soft">{detail}</span>
    {action && <span className={`block ${learned || !block ? 'text-accent' : 'text-ink-on-dark-soft'}`}>{action}</span>}
  </button>
}

function ClassEdit({ outfitId, profile }: { outfitId: string; profile: RpgProfile }) {
  const options = rpgClassOptions(profile.sourceAptitudes).flatMap((classId) => RPG_CLASS_WEAPONS[classId].map((set, i) =>
    ({ value: `${classId}:${i}`, label: `${CLASS_LABEL[classId]} · ${weaponsLabel(set)}` })))
  const current = `${profile.classId}:${RPG_CLASS_WEAPONS[profile.classId].findIndex((set) => set.every((w, i) => w === profile.weapons[i]))}`
  if (options.length < 2) return null
  return <RpgSelect label="Class and weapons (free to change until she learns a skill)" value={current} options={options}
    onChange={(value) => { const [classId, index] = value.split(':') as [RpgClass, string]; void commit(() => changeRpgOutfitClass(outfitId, classId, [...RPG_CLASS_WEAPONS[classId][Number(index)]!])) }} />
}

// --- Party editor ----------------------------------------------------------------------------------------------------

export function RpgPartyEditScreen() {
  const { presetId = '' } = useParams()
  const { content, account } = useRpg()
  const owned = useGame((state) => state.umas)
  const row = account.presets.find((p) => p.id === presetId)
  const [name, setName] = useState(row?.data.name ?? '')
  const [picking, setPicking] = useState<number | null>(null)
  useEffect(() => { setName(row?.data.name ?? '') }, [row?.data.name])
  if (!row) return <ScreenState title="Party unavailable" detail="Choose one of your parties." action={{ label: 'Parties', to: '/rpg' }} />
  const preset = row.data
  const profiles = rpgOutfitProfiles(account)
  const label = (id: string) => content.umas.byId.get(id)?.name ?? id
  const save = (next: RpgPresetSave) => void commit(() => saveRpgParty(next))
  const setSlot = (index: number, outfitId: string) => {
    const profile = profiles.get(outfitId)
    const slots = [...preset.slots] as RpgPresetSave['slots']
    slots[index] = profile ? { outfitId, loadout: [], familiar: 'greatsword' } : null
    save({ ...preset, slots })
  }
  // The picker offers enrolled Umas that no party holds yet, highest RPG level first.
  const enrolled = [...account.outfits.keys()].filter((id) => owned[id])
  const levelOf = (id: string) => rpgMemberLevel(profiles.get(id)!)
  const available = rpgPartyCandidates(enrolled, account.presets.map((p) => p.data.slots), levelOf, label)
  const profileLink = (id: string) => `/rpg/roster/${encodeURIComponent(id)}?party=${presetId}`
  return <RpgFrame back={isFull(preset) ? `/rpg/party/${presetId}` : '/rpg'} backLabel="Back" eyebrow="Edit party" title={preset.name} guide="party">
    <label className="block text-[11px] font-semibold text-ink-on-dark-soft">Name
      <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== preset.name) save({ ...preset, name: name.trim() }) }}
        className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage px-3 text-[15px] text-ink-on-dark" />
    </label>
    {enrolled.length === 0 && <RpgCard className="mt-3"><p className="text-sm">Enroll Umas in the Roster first.</p><Link to="/rpg/roster" className="mt-2 flex min-h-11 items-center text-accent">Open Roster</Link></RpgCard>}
    <div className="mt-3 space-y-2">{preset.slots.map((slot, index) => {
      const profile = slot ? profiles.get(slot.outfitId) : null
      return <RpgCard key={index}>
        <div className="flex items-center gap-3">
          {slot && profile ? <Link to={profileLink(slot.outfitId)} aria-label={`${label(slot.outfitId)}: profile and skill trees`} className="w-14 shrink-0">
            <OutfitIcon content={content} outfitId={slot.outfitId} name={label(slot.outfitId)} profile={profile} className="aspect-square w-14" /></Link>
            : <button type="button" onClick={() => setPicking(index)} aria-label={`Add a member to slot ${index + 1}`}
              className="flex aspect-square w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-hairline-dark text-xl text-ink-on-dark-soft">+</button>}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-wide text-ink-on-dark-soft uppercase">Slot {index + 1}</p>
            {slot && profile ? <>
              <Link to={profileLink(slot.outfitId)} className="flex min-h-6 items-center gap-1 text-[14px] font-semibold"><span className="truncate">{label(slot.outfitId)}</span><ChevronRightIcon size={16} className="shrink-0 text-accent" /></Link>
              <p className="text-[11px] text-ink-on-dark-soft">{formatRpgLevel(rpgMemberLevel(profile))} · {CLASS_LABEL[profile.classId]}</p>
            </> : <p className="text-[13px] text-ink-on-dark-soft">Empty</p>}
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <GhostButton onClick={() => setPicking(index)}>{slot ? 'Swap' : 'Add'}</GhostButton>
            {slot && <GhostButton aria-label={`Remove ${label(slot.outfitId)} from the party`} onClick={() => setSlot(index, '')}>Remove</GhostButton>}
          </div>
        </div>
        {slot && profile && <SlotLoadout presetId={presetId} profile={profile} slot={slot} />}
      </RpgCard>
    })}</div>
    {isFull(preset) && <Link to={`/rpg/party/${presetId}`} className="mt-4 flex min-h-12 items-center justify-center rounded-sm bg-accent text-[15px] font-semibold text-ink">Choose a chapter</Link>}
    {picking !== null && <RpgModalFocus onClose={() => setPicking(null)}><div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setPicking(null)}>
      <div role="dialog" aria-modal="true" aria-label={`Choose a member for slot ${picking + 1}`} onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[80dvh] w-full overflow-y-auto rounded-t-lg border border-hairline-dark bg-stage-soft p-4">
        <p className="text-sm font-semibold">Slot {picking + 1}</p>
        <p className="text-[11px] text-ink-on-dark-soft">Enrolled Umas not in any party, highest level first.</p>
        {available.length ? <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">{available.map((id) =>
          <button key={id} type="button" onClick={() => { setSlot(picking, id); setPicking(null) }} aria-label={`${label(id)} · ${formatRpgLevel(levelOf(id))}`} className="min-w-0">
            <OutfitIcon content={content} outfitId={id} name={label(id)} profile={profiles.get(id)} />
            <span className="mt-1 block truncate text-center text-[11px] font-semibold">{label(id)}</span>
            <span className="block text-center text-[10px] text-ink-on-dark-soft">{formatRpgLevel(levelOf(id))}</span>
          </button>)}</div>
          : <><p className="mt-3 text-sm">Every enrolled Uma is already in a party. Enroll more in the Roster, or remove one from another party first.</p>
            <Link to="/rpg/roster" className="mt-2 flex min-h-11 items-center text-accent">Open Roster</Link></>}
      </div></div></RpgModalFocus>}
  </RpgFrame>
}

function SlotLoadout({ presetId, profile, slot }: { presetId: string; profile: RpgProfile; slot: RpgPresetSlot }) {
  const learned = rpgLearnedSkills(profile)
  const slots = rpgActiveSlots(profile.level)
  const keys = new Set(slot.loadout.map(rpgNodeKey))
  const toggle = (ref: RpgNodeRef) => {
    const next = keys.has(rpgNodeKey(ref)) ? slot.loadout.filter((r) => rpgNodeKey(r) !== rpgNodeKey(ref)) : [...slot.loadout, ref]
    if (next.length > slots) { pushToast(`${slots} skill slots at this level`); return }
    void commit(() => equipRpgSkills(presetId, profile.outfitId, next))
  }
  return <div className="mt-2 space-y-2">
    <p className="text-[11px] text-ink-on-dark-soft">{CLASS_LABEL[profile.classId]} · {weaponsLabel(profile.weapons)}</p>
    {profile.classId === 'summoner' && <div className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Familiar form"><span className="text-ink-on-dark-soft">Familiar</span>
      {RPG_WEAPON_KINDS.map((kind) => <button key={kind} type="button" aria-pressed={kind === slot.familiar} aria-label={`Familiar: ${WEAPON_KIND_LABEL[kind]}`}
        onClick={() => { if (kind !== slot.familiar) void commit(() => equipRpgSkills(presetId, profile.outfitId, slot.loadout, kind)) }}
        className={`flex min-h-9 min-w-9 items-center justify-center rounded-full border px-2 ${kind === slot.familiar ? 'border-accent bg-accent/15' : 'border-hairline-dark'}`}><WeaponKindMark kind={kind} /></button>)}
    </div>}
    {learned.length === 0 ? <p className="text-[11px] text-ink-on-dark-soft">No skills learned yet: spend her points on her profile.</p>
      : <div className="flex flex-wrap gap-1.5" aria-label={`Skills, ${slot.loadout.length} of ${slots} equipped`}>{learned.map((ref) => {
        const node = rpgNode(ref.id)!
        const on = keys.has(rpgNodeKey(ref))
        return <button key={rpgNodeKey(ref)} type="button" aria-pressed={on} onClick={() => toggle(ref)}
          className={`flex min-h-9 items-center gap-1 rounded-full border px-2 text-[11px] ${on ? 'border-accent bg-accent/15 text-ink-on-dark' : 'border-hairline-dark text-ink-on-dark-soft'}`}>
          {node.skill && <KindMark kind={node.skill.primary} />}{node.name}{ref.tier < profile.tier ? ` · T${ref.tier}` : ''}</button>
      })}<span className="self-center text-[10px] text-ink-on-dark-soft">{slot.loadout.length}/{slots}</span></div>}
  </div>
}

// --- Launch pad ------------------------------------------------------------------------------------------------------

export function RpgLaunchScreen() {
  const { presetId = '' } = useParams()
  const { content, account, chapters, release, retryRelease } = useRpg()
  const navigate = useNavigate()
  const row = account.presets.find((p) => p.id === presetId)
  if (!row) return <ScreenState title="Party unavailable" detail="Choose one of your parties." action={{ label: 'Parties', to: '/rpg' }} />
  const preset = row.data
  const profiles = rpgOutfitProfiles(account)
  const level = partyLevel(preset, profiles)
  const label = (id: string) => content.umas.byId.get(id)?.name ?? id
  return <RpgFrame back="/rpg" backLabel="Parties" eyebrow={preset.name} title="Chapters" guide="map"
    trailing={<Link to={`/rpg/party/${presetId}/edit`} className="flex min-h-11 items-center rounded-sm border border-hairline-dark bg-stage-soft px-3 text-[12px] font-semibold">Edit</Link>}>
    <Link to={`/rpg/party/${presetId}/edit`} className="grid grid-cols-5 gap-1.5" aria-label="Party members">
      {preset.slots.map((slot, i) => slot ? <OutfitIcon key={i} content={content} outfitId={slot.outfitId} name={label(slot.outfitId)} profile={profiles.get(slot.outfitId)} />
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
      const end = chapter.levelStart + RPG_CHAPTER_LEVELS - 1
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

