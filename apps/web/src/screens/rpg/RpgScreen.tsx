// Lazy account RPG hub and setup (docs/design/uma-rpg.md#phone-presentation, T099).
import {
  RPG_ELEMENTS, RPG_PARTY_SIZE, STRATEGIES, canUseRpgSignature,
  projectRpgStats, rpgActiveSlots, rpgAffinities, rpgExpToNext, rpgSkillKey,
  rpgTreePointsEarned, rpgTreePointsSpent, rpgWeaponsForStyle,
  type RpgCommandRequest, type RpgElement, type RpgPresetSaveV1, type RpgPresetSlotV1, type RpgProfile,
  type RpgWeapon, type Strategy, type UmaTemplate,
} from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useState, createContext, useContext } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import type { LoadedContent } from '../../content/runtime'
import type { RpgRelease } from '../../content/rpg-release'
import { db, type PendingRpgCommandRow, type VersionedRow } from '../../game/db'
import { enrollOwnedRpgOutfit, readRpgHub, refreshRpgHubFromCloud, saveRpgPreset, validateRpgPresetSlots,
  type RpgHubView } from '../../game/rpg-hub'
import { gameRuntime } from '../../game/runtime'
import { setSyncState, useGame } from '../../game/store'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Meter } from '../../ui/Meter'
import { Numeral } from '../../ui/Numeral'
import { Panel } from '../../ui/Panel'
import { ScreenState } from '../../ui/ScreenState'
import { RpgElementLegend, RpgPortrait, RPG_ELEMENT_LABELS, RPG_WEAPON_LABELS } from '../../ui/rpg/RpgPortrait'
import { RpgProgressionEditor } from '../../ui/rpg/RpgProgressionEditor'
import { orderRpgRoster, rpgPartyOptions } from '../../ui/rpg/roster-options'
import { RpgProgressionHost } from '../../game/rpg-progression-host'
import { RpgGuide, rpgGuideMemory } from './RpgGuide'
import { useRpgRelease } from './useRpgRelease'
const progressionHost = new RpgProgressionHost()

interface Context { content: LoadedContent; view: RpgHubView; refresh: () => Promise<void>; release: RpgRelease | null; retryRelease: () => void }
const RpgContext = createContext<Context | null>(null)
function useRpg(): Context {
  const value = useContext(RpgContext)
  if (!value) throw new Error('RPG screen must be inside its shell')
  return value
}

const title = (value: string) => value[0]!.toUpperCase() + value.slice(1)
const emptySlots = (slots: RpgPresetSaveV1['slots']) => slots.filter((slot) => slot === null).length
const templateName = (template: UmaTemplate | undefined, id: string) => template?.name ?? `Unavailable outfit (${id})`
const pendingFor = (row: PendingRpgCommandRow, action: RpgCommandRequest['action'], id: string) => {
  const body = row.body as RpgCommandRequest
  return body.action === action && body.upserts.some((upsert) => upsert.id === id)
}

function useHubView(enabled: boolean) {
  const [view, setView] = useState<RpgHubView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => {
    if (!enabled) return
    try { setView(await readRpgHub()); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  useEffect(() => {
    if (!enabled) return
    const subscription = liveQuery(readRpgHub).subscribe({
      next: (next) => { setView(next); setError(null) },
      error: (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)),
    })
    const focus = () => { void refresh() }
    window.addEventListener('focus', focus)
    return () => { subscription.unsubscribe(); window.removeEventListener('focus', focus) }
  }, [enabled])
  return { view, error, refresh }
}

async function requestSync(): Promise<void> {
  const [rpg, ordinary] = await Promise.all([db.pendingRpgCommands.count(), db.outbox.count()])
  const pending = rpg + ordinary
  setSyncState({ status: navigator.onLine ? 'pending' : 'offline', pending, error: null })
  gameRuntime.schedule(0)
  await gameRuntime.flush()
}

function SaveNotice({ message }: { message?: string | null }) {
  const sync = useGame((state) => state.sync)
  if (!message && sync.pending === 0 && !sync.error) return null
  return <p role="status" className="mb-3 rounded-sm border border-warning/30 bg-accent-wash p-3 text-[12px] leading-5">
    {message ?? (sync.error ? `Sync needs attention: ${sync.error}` : sync.status === 'offline'
      ? 'Offline: RPG changes are queued but not yet saved to your account.' : 'RPG changes are pending account acknowledgement.')}
  </p>
}

export function RpgShell() {
  const status = useGame((state) => state.status)
  const persistent = useGame((state) => state.persistent)
  const contentState = useContent()
  const { view, error, refresh } = useHubView(status === 'ready' && persistent)
  const campaign = useRpgRelease(contentState.status === 'ready' ? contentState.content : null)
  const [guide, setGuide] = useState(() => !rpgGuideMemory.seen())
  const closeGuide = () => { rpgGuideMemory.remember(); setGuide(false) }
  if (status !== 'ready') return <ScreenState title="RPG unavailable" detail="Open your saved game first." action={{ label: 'Home', to: '/' }} />
  if (!persistent) return <ScreenState title="RPG save unavailable" detail="RPG party changes require the persistent account save. Your other game modes remain available." action={{ label: 'Home', to: '/' }} />
  if (contentState.status !== 'ready') return <ScreenState title="RPG content unavailable" detail="Your private Uma catalog must load before outfit enrollment." action={{ label: 'Home', to: '/' }} />
  if (error) return <ScreenState title="RPG save needs attention" detail={error} action={{ label: 'Home', to: '/' }} />
  if (!view) return <ScreenState title="Loading RPG roster" detail="Reading saved outfits and parties." />
  const nav = [{ to: '/rpg', label: 'Hub', end: true }, { to: '/rpg/roster', label: 'Roster', end: false },
    { to: '/rpg/parties', label: 'Parties', end: false }]
  return <RpgContext.Provider value={{ content: contentState.content, view, refresh, release: campaign.state, retryRelease: campaign.retry }}>
    <div className="flex h-dvh flex-col bg-page">
      <header className="pt-safe border-b border-hairline bg-panel px-4 pb-2">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Link to="/" className="flex min-h-11 items-center text-[13px] font-semibold text-ink-soft">← Home</Link>
          <h1 className="font-display text-xl">Uma RPG</h1>
          <button aria-label="RPG guide" className="min-h-11 rounded-sm border border-hairline px-2 text-xs font-semibold" onClick={() => setGuide(true)}>How to play</button>
        </div>
        <nav aria-label="RPG menus" className="grid grid-cols-3 gap-1 rounded-sm bg-sunken p-1">
          {nav.map(({ to, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) =>
            `flex min-h-11 items-center justify-center rounded-xs text-[13px] font-semibold ${isActive ? 'bg-panel text-ink shadow-1' : 'text-ink-soft'}`}>{label}</NavLink>)}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-safe">
        <div className="mx-auto max-w-xl pb-8"><Outlet /></div>
      </main>
      {guide && <RpgGuide onClose={closeGuide} />}
    </div>
  </RpgContext.Provider>
}

export function RpgHubScreen() {
  const { view, content, release, retryRelease } = useRpg()
  const owned = useGame((state) => state.umas)
  return <><SaveNotice /><RpgHubContent view={view} content={content} ownedIds={Object.keys(owned)} release={release} retryRelease={retryRelease} /></>
}

/** Read-only projection also used by the isolated phone proof; no hosts or enrollment side effects. */
export function RpgHubContent({ view, content, ownedIds, release, retryRelease, names = {} }: {
  view: RpgHubView; content: LoadedContent | null; ownedIds: readonly string[]; release: RpgRelease | null
  retryRelease: () => void; names?: Record<string, string>
}) {
  const owned = new Set(ownedIds)
  const eligible = ownedIds.filter((id) => {
    const aptitudes = content?.umas.byId.get(id)?.aptitudes ?? view.outfits.get(id)?.data.profile.sourceAptitudes
    return aptitudes && STRATEGIES.some((style) => aptitudes.strategy[style] === 'A')
  })
  const profiles = new Map([...view.outfits].filter(([id]) => owned.has(id)).map(([id, saved]) => [id, saved.data.profile]))
  return <div className="space-y-3">
    <div><p className="text-micro text-ink-soft">Account campaign · independent progression</p><h2 className="mt-1 text-2xl">Your RPG parties</h2>
      <p className="mt-1 text-[13px] text-ink-soft">Five presets share outfit RPG levels. A chapter needs five distinct enrolled outfits; no running-style quota.</p></div>
    <Panel className="grid grid-cols-2 gap-2 text-center"><div><Numeral className="text-xl">{view.outfits.size}</Numeral><p className="text-[11px] text-ink-soft">enrolled outfits</p></div>
      <div><Numeral className="text-xl">{eligible.length}</Numeral><p className="text-[11px] text-ink-soft">eligible owned</p></div></Panel>
    {!release && <p role="status" className="text-xs text-ink-soft">Checking the private chapter and portraits…</p>}
    {release?.status === 'unavailable' && <Panel><p role="status" className="text-sm">Campaign unavailable</p><p className="mt-1 text-xs leading-5 text-ink-soft">{release.reason}</p><Button variant="secondary" className="mt-2 w-full" onClick={retryRelease}>Retry campaign check</Button></Panel>}
    {release?.status === 'ready' && <p className="text-xs text-ink-soft">{release.pack.chapters.length} published {release.pack.chapters.length === 1 ? 'chapter' : 'chapters'} · {release.pack.version}</p>}
    {view.presets.map((row) => {
      const filled = RPG_PARTY_SIZE - emptySlots(row.data.slots)
      const ready = filled === RPG_PARTY_SIZE && validateRpgPresetSlots(row.data.slots, profiles) === null
      const checkpoint = view.checkpoints.find(c => c.data.presetId === row.id && c.data.chapterId === row.data.foregroundChapterId)
      const chapterId = checkpoint?.data.chapterId ?? (release?.status === 'ready' ? release.chapterId : null)
      const chapterHref = `/rpg/chapters/${row.id}${chapterId ? `?chapter=${encodeURIComponent(chapterId)}` : ''}`
      const pending = view.pending.some(p => (p.body as RpgCommandRequest).upserts.some(u => u.id === row.id || u.kind === 'rpgCheckpoints' && u.id.startsWith(`${row.id}:`)))
      const action = checkpoint?.data.status === 'in-battle' ? 'Continue saved battle' : checkpoint?.data.status === 'pending-result' ? 'Collect accepted win'
        : checkpoint?.data.status === 'cleared' ? 'Review clear / replay' : checkpoint ? 'Resume chapter' : 'Choose chapter'
      return <Panel key={row.id}>
        <div className="flex items-center justify-between gap-2"><h3 className="font-display text-[17px] font-semibold">{row.data.name}</h3><Link to={`/rpg/parties/${row.id}`} className="flex min-h-11 items-center text-xs font-semibold text-accent-strong">Edit party</Link></div>
        <p className="text-xs text-ink-soft">{filled}/{RPG_PARTY_SIZE} outfits · {ready ? 'Party ready' : 'Needs five distinct outfits'}{pending ? ' · Pending / needs sync' : ''}</p>
        {filled > 0 && <div className="mt-2 grid grid-cols-5 gap-1" aria-label={`${row.data.name} members`}>{row.data.slots.map((slot, i) => {
          const profile = slot && view.outfits.get(slot.outfitId)?.data.profile
          const name = slot ? names[slot.outfitId] ?? templateName(content?.umas.byId.get(slot.outfitId), slot.outfitId) : ''
          return slot ? <div key={i} className="min-w-0"><RpgPortrait content={content} compact outfitId={slot.outfitId} name={name} weapon={profile?.weapon ?? null} element={slot.signature} className="h-16" /><p className="mt-1 truncate text-center text-[11px] font-semibold" title={name}>{name}</p><p className="text-center text-[10px] text-ink-soft">{profile ? `T${profile.tier} · Lv${profile.level}` : 'Unavailable'}</p></div> : <div key={i} className="flex h-16 items-center justify-center rounded-sm border border-hairline text-xs text-ink-faint">Empty</div>
        })}</div>}
        {checkpoint && <p className="mt-2 text-xs text-ink-soft">Attempt {checkpoint.data.attemptIndex} · {checkpoint.data.selectedPath.length} accepted checkpoints · {checkpoint.data.status.replaceAll('-', ' ')}</p>}
        {release?.status === 'ready' && (ready || checkpoint) && <Link to={chapterHref} className="mt-2 flex min-h-11 items-center justify-center rounded-sm bg-accent px-3 text-sm font-semibold text-ink">{action} · {row.data.name}</Link>}
        {release?.status !== 'ready' && checkpoint && <Link to={chapterHref} className="mt-2 flex min-h-11 items-center text-xs font-semibold text-accent-strong">Review saved chapter / content recovery</Link>}
      </Panel>
    })}
    <Link to="/rpg/roster" className="inline-flex min-h-11 items-center font-semibold text-accent-strong">Browse owned RPG roster →</Link>
    <Link to="/farm/items" className="flex min-h-11 items-center font-semibold text-accent-strong">Global Items · Inspiration tokens</Link>
  </div>
}

export function RpgRosterScreen() {
  const { view, content } = useRpg()
  const owned = useGame((state) => state.umas)
  return <><SaveNotice /><RpgRosterContent view={view} content={content} ownedIds={Object.keys(owned)} /></>
}

/** Read-only tiles, shared with the synthetic phone proof without opening account storage. */
export function RpgRosterContent({ view, content, ownedIds, names = {} }: {
  view: RpgHubView; content: LoadedContent | null; ownedIds: readonly string[]; names?: Record<string, string>
}) {
  const name = (id: string) => names[id] ?? templateName(content?.umas.byId.get(id), id)
  const ids = orderRpgRoster(ownedIds, new Set(view.outfits.keys()), name)
  return <div className="space-y-3">
    <div><p className="text-micro text-ink-soft">Owned outfits</p><h2 className="mt-1 text-2xl">RPG roster</h2>
      <p className="mt-1 text-[12px] text-ink-soft">RPG Tier and Level belong to the outfit, separate from Racing, Training and Farm.</p></div>
    <RpgElementLegend />
    {ids.length === 0 && <ScreenState title="No owned outfits" detail="Acquire an Uma outfit in the Stable before making an RPG party." />}
    {[true, false].map(enrolled => {
      const group = ids.filter(id => view.outfits.has(id) === enrolled)
      if (group.length === 0) return null
      const label = enrolled ? 'Enrolled' : 'Not enrolled'
      return <section key={label} aria-label={label}>
        <h3 className="mb-2 text-[12px] font-semibold text-ink-soft">{label} · {group.length}</h3>
        <div className="grid grid-cols-5 gap-x-1.5 gap-y-3" aria-label={`${label} outfits`}>
          {group.map((id) => {
            const template = content?.umas.byId.get(id)
            const profile = view.outfits.get(id)?.data.profile
            const eligible = template && STRATEGIES.some((style) => template.aptitudes.strategy[style] === 'A')
            const pending = view.pending.some((row) => row.status === 'pending' && pendingFor(row, 'enroll', id))
            const status = profile ? `Tier ${profile.tier} · RPG Lv${profile.level}` : pending ? 'Enrollment pending' : eligible ? 'Ready to enroll' : 'No A running style'
            const identity = profile ? ` · ${RPG_WEAPON_LABELS[profile.weapon]} · ${RPG_ELEMENT_LABELS[profile.defaultSignature]}` : ''
            return <Link key={id} to={`/rpg/roster/${encodeURIComponent(id)}`} aria-label={`${name(id)} · ${status}${identity}`}
              className="block min-h-11 min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-accent">
              <RpgPortrait content={content} compact artwork="icon" outfitId={id} name={name(id)} weapon={profile?.weapon ?? null} element={profile?.defaultSignature ?? null} className="aspect-square w-full" />
              <span className="mt-1 block truncate text-center text-[11px] font-semibold" title={name(id)}>{name(id)}</span>
              <span className="block text-center text-[10px] text-ink-soft">{profile ? `T${profile.tier} · Lv${profile.level}` : pending ? 'Pending' : eligible ? 'Enroll' : 'Ineligible'}</span>
            </Link>
          })}
        </div>
      </section>
    })}
  </div>
}

export function RpgOutfitPicker({ view, draft, index, ownedIds, content, names = {}, onChange }: {
  view: RpgHubView; draft: RpgPresetSaveV1; index: number; ownedIds: readonly string[]
  content: LoadedContent | null; names?: Record<string, string>; onChange: (id: string) => void
}) {
  const name = (id: string) => names[id] ?? templateName(content?.umas.byId.get(id), id)
  const available = rpgPartyOptions(view, draft, index, ownedIds).sort((a, b) => name(a).localeCompare(name(b)) || a.localeCompare(b))
  return <SelectField label={`Outfit for slot ${index + 1}`} value={draft.slots[index]?.outfitId ?? ''}
    options={[{ value: '', label: 'Empty slot' }, ...available.map(id => ({ value: id, label: name(id) }))]}
    onChange={id => { if (id === '' || available.includes(id)) onChange(id) }} />
}

function AffinityList({ aptitudes }: { aptitudes: UmaTemplate['aptitudes'] }) {
  const affinities = rpgAffinities(aptitudes)
  return <div className="space-y-1 text-[12px] text-ink-soft"><p className="font-semibold text-ink">Distance → element affinity</p>
    <p>{Object.entries(aptitudes.distance).map(([distance, grade]) => `${title(distance)} ${grade}`).join(' · ')}</p>
    <p>{RPG_ELEMENTS.map((element) => `${RPG_ELEMENT_LABELS[element]} ${affinities[element] ?? '—'}`).join(' · ')}</p>
    <p>A opens all five tree depths; B opens depths 1–3. Surface aptitude themes chapters, not these trees.</p>
  </div>
}

function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void
}) {
  return <label className="block text-[12px] font-semibold text-ink-soft">{label}
    <select value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-3 text-[14px] text-ink">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
}

export function RpgProfileScreen() {
  const { outfitId } = useParams()
  const { content, view } = useRpg()
  const owned = useGame((state) => state.umas)
  const template = outfitId ? content.umas.byId.get(outfitId) : undefined
  const saved = outfitId ? view.outfits.get(outfitId) : undefined
  const profile = saved?.data.profile
  const styles = template ? STRATEGIES.filter((candidate) => template.aptitudes.strategy[candidate] === 'A') : []
  const [style, setStyle] = useState<Strategy | null>(null)
  const chosenStyle = style && styles.includes(style) ? style : styles[0]
  const weapons = chosenStyle ? rpgWeaponsForStyle(chosenStyle) : []
  const [weapon, setWeapon] = useState<RpgWeapon | null>(null)
  const chosenWeapon = weapon && weapons.includes(weapon) ? weapon : weapons[0]
  const elements = template ? RPG_ELEMENTS.filter((element) => rpgAffinities(template.aptitudes)[element]) : []
  const [signature, setSignature] = useState<RpgElement | null>(null)
  const chosenSignature = signature && elements.includes(signature) ? signature : elements[0]
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const navigate = useNavigate()
  if (!outfitId || !owned[outfitId]) return <ScreenState title="Outfit unavailable" detail="This RPG profile needs an owned outfit." action={{ label: 'Roster', to: '/rpg/roster' }} />
  if (!template) return <ScreenState title="Private content unavailable" detail="This owned outfit is missing from the current verified Uma catalog. Its save is unchanged." action={{ label: 'Roster', to: '/rpg/roster' }} />
  const pending = view.pending.find((row) => pendingFor(row, 'enroll', outfitId))
  const stats = profile ? projectRpgStats(profile) : null
  const submit = async () => {
    if (!chosenStyle || !chosenWeapon || !chosenSignature || busy) return
    setBusy(true); setNotice(null)
    try {
      const ownedRow = await db.umas.get(outfitId)
      if (!ownedRow) throw new Error('Owned outfit save is unavailable.')
      await enrollOwnedRpgOutfit({ template, contentVersion: content.manifest.version, style: chosenStyle,
        weapon: chosenWeapon, defaultSignature: chosenSignature, expectedUmaVersion: ownedRow.version })
      setConfirm(false)
      await requestSync()
      setNotice(await db.rpgOutfits.get(outfitId) ? 'Enrollment saved to your account.'
        : 'Enrollment pending sync. The locked class appears after account acknowledgement.')
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <div className="space-y-3">
    <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-[13px] font-semibold text-ink-soft">← Back to roster</button>
    <SaveNotice message={notice ?? (pending?.status === 'conflict' ? 'Enrollment conflicted on another device. Reload the current roster before trying again.' : null)} />
    <div className="grid grid-cols-[108px_1fr] gap-3"><RpgPortrait content={content} outfitId={outfitId} name={template.name} weapon={profile?.weapon ?? chosenWeapon ?? null} element={profile?.defaultSignature ?? chosenSignature ?? null} className="aspect-[4/5]" />
      <div><p className="text-micro text-ink-soft">{template.outfit ?? 'Original outfit'}</p><h2 className="mt-1 text-xl">{template.name}</h2>
        <p className="mt-2 text-[12px] text-ink-soft">{profile ? `RPG Tier ${profile.tier} · Lv${profile.level}` : 'Not enrolled in RPG'}</p>
        <p className="mt-1 text-[11px] text-ink-faint">Race Uma Lv{owned[outfitId]?.level} is separate.</p></div></div>
    <RpgElementLegend />
    <Panel><AffinityList aptitudes={profile?.sourceAptitudes ?? template.aptitudes} /></Panel>
    {profile && stats ? <>
      <Panel><p className="text-micro">Locked class identity</p><p className="mt-1 text-[15px] font-semibold">{title(profile.style)} · {RPG_WEAPON_LABELS[profile.weapon]}</p>
        <p className="mt-1 text-[12px] text-ink-soft">Default signature: {RPG_ELEMENT_LABELS[profile.defaultSignature]} · frozen from content {profile.sourceContentVersion}</p>
        <p className="mt-2 text-[11px] text-ink-faint">Style and weapon cannot be changed across presets or promotions. A preset may choose another eligible signature.</p></Panel>
      <Panel><p className="text-micro">RPG progression</p><p className="mt-1 text-[13px]">Tier {profile.tier} · Level {profile.level} · {profile.level === 50 ? `${profile.exp} banked EXP` : `${profile.exp}/${rpgExpToNext(profile.level)} EXP`}</p>
        {profile.level < 50 && <Meter value={profile.exp / rpgExpToNext(profile.level)} color="var(--color-accent)" />}
        <p className="mt-2 text-[12px] text-ink-soft">{rpgActiveSlots(profile.level)} active skill slots · {rpgTreePointsEarned(profile.level) - rpgTreePointsSpent(profile.tree)} unspent tree points</p></Panel>
      <Panel><p className="text-micro">Combat attributes</p><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
        {([['ATK / MATK', `${stats.atk} / ${stats.matk}`], ['HP / MP', `${stats.hp} / ${stats.mp}`], ['Initiative', stats.initiative], ['PDEF / MDEF', `${stats.pdef} / ${stats.mdef}`], ['Dexterity', stats.dexterity]] as const).map(([label, value]) => <p key={label} className="flex justify-between gap-2"><span className="text-ink-soft">{label}</span><span className="font-semibold">{value}</span></p>)}
      </div><p className="mt-2 text-[11px] text-ink-faint">Growth derives from frozen base stats and growth rates, not Racing, Training or Farm progress.</p></Panel>
      <RpgProgressionEditor host={progressionHost} outfitId={outfitId} onSync={requestSync} />
    </> : styles.length === 0 ? <ScreenState title="Not RPG-eligible" detail="This outfit has no A running-style aptitude. It remains usable in every other game mode." />
      : pending?.status === 'pending' ? <ScreenState title="Enrollment pending" detail="This outfit will be available for parties after the account acknowledges it." />
        : <Panel><p className="text-micro">One-time enrollment</p><p className="mt-1 text-[12px] text-ink-soft">Only A running styles are offered. The selected style and weapon are permanent for this delivery.</p>
          <div className="mt-3 space-y-3">
            <SelectField label="A running-style class" value={chosenStyle!} options={styles.map((value) => ({ value, label: title(value) }))} onChange={(value) => { setStyle(value); setWeapon(null) }} />
            <SelectField label="Locked weapon path" value={chosenWeapon!} options={weapons.map((value) => ({ value, label: RPG_WEAPON_LABELS[value] }))} onChange={setWeapon} />
            <SelectField label="Default signature element" value={chosenSignature!} options={elements.map((value) => ({ value, label: `${RPG_ELEMENT_LABELS[value]} · ${rpgAffinities(template.aptitudes)[value]}` }))} onChange={setSignature} />
            <Button disabled={busy} className="w-full" onClick={() => setConfirm(true)}>Review permanent choice</Button>
          </div></Panel>}
    <BottomSheet open={confirm} onClose={() => setConfirm(false)}><h3 className="text-xl">Lock this RPG class?</h3>
      <p className="mt-2 text-[14px] leading-6">{template.name} will become a <strong>{chosenStyle && title(chosenStyle)}</strong> using <strong>{chosenWeapon && RPG_WEAPON_LABELS[chosenWeapon]}</strong>. The class and weapon remain fixed across parties and promotions. {chosenSignature && RPG_ELEMENT_LABELS[chosenSignature]} is the default signature; party slots can change it.</p>
      <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Button><Button disabled={busy} className="flex-1" onClick={() => void submit()}>Confirm enrollment</Button></div>
    </BottomSheet>
  </div>
}

export function RpgPartiesScreen() {
  const { view } = useRpg()
  return <div className="space-y-3"><SaveNotice /><h2 className="text-2xl">Party presets</h2><p className="text-[12px] text-ink-soft">Five saved teams. A preset may be partial while you build it.</p>
    {view.presets.map((row) => <Link key={row.id} to={`/rpg/parties/${row.id}`} className="block min-h-16 rounded-md border border-hairline bg-panel p-4 shadow-1">
      <span className="flex justify-between"><span className="font-semibold">{row.data.name}</span><span className="text-accent-strong">Edit →</span></span>
      <span className="text-[12px] text-ink-soft">{RPG_PARTY_SIZE - emptySlots(row.data.slots)} of {RPG_PARTY_SIZE} slots filled</span></Link>)}
  </div>
}

function partyDraft(row: VersionedRow<RpgPresetSaveV1>): RpgPresetSaveV1 {
  return { ...row.data, slots: row.data.slots.map((slot) => slot ? { ...slot, loadout: [...slot.loadout] } : null) as RpgPresetSaveV1['slots'] }
}

export function RpgPartyScreen() {
  const { presetId } = useParams()
  const { view, content, refresh } = useRpg()
  const owned = useGame((state) => state.umas)
  const row = view.presets.find((preset) => preset.id === presetId)
  const [draft, setDraft] = useState<RpgPresetSaveV1 | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [baseVersion, setBaseVersion] = useState<number | null>(null)
  const [observedOutfits, setObservedOutfits] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!row) return
    if (draftId !== row.id || !dirty || baseVersion === null) {
      setDraft(partyDraft(row)); setBaseVersion(row.version); setDraftId(row.id); setDirty(false)
      setObservedOutfits(Object.fromEntries(row.data.slots.flatMap((slot) => slot
        ? [[slot.outfitId, view.outfits.get(slot.outfitId)?.version ?? -1] as const] : [])))
    }
    else if (row.version !== baseVersion) setNotice('This party changed on another screen or device. Reload its latest saved version before editing.')
  }, [row?.version, presetId])
  if (!row || !draft || draftId !== row.id) return <ScreenState title="Loading party" detail="Reading the selected RPG preset." action={{ label: 'Parties', to: '/rpg/parties' }} />
  const pending = view.pending.find((entry) => pendingFor(entry, 'edit-preset', row.id))
  const profiles = new Map([...view.outfits].filter(([id]) => owned[id]).map(([id, saved]) => [id, saved.data.profile]))
  const changedOutfit = draft.slots.some((slot) => slot && observedOutfits[slot.outfitId] !== view.outfits.get(slot.outfitId)?.version)
  const problem = validateRpgPresetSlots(draft.slots, profiles)
  const update = (next: RpgPresetSaveV1) => {
    setObservedOutfits((previous) => ({ ...Object.fromEntries(Object.entries(previous).filter(([id]) => next.slots.some((slot) => slot?.outfitId === id))),
      ...Object.fromEntries(next.slots.flatMap((slot) => slot && previous[slot.outfitId] === undefined
        ? [[slot.outfitId, view.outfits.get(slot.outfitId)?.version ?? -1] as const] : [])) }))
    setDraft(next); setDirty(true); setNotice(null)
  }
  const setSlot = (index: number, slot: RpgPresetSlotV1 | null) => {
    const slots = [...draft.slots] as RpgPresetSaveV1['slots']
    slots[index] = slot
    update({ ...draft, slots })
  }
  const save = async () => {
    if (busy || baseVersion === null || baseVersion !== row.version || changedOutfit || problem) return
    setBusy(true); setNotice(null)
    try {
      await saveRpgPreset({ preset: draft, expectedVersion: baseVersion, expectedOutfitVersions: observedOutfits })
      setDirty(false)
      await requestSync()
      setNotice((await db.rpgPresets.get(draft.presetId))?.version === baseVersion + 1
        ? 'Party saved to your account.' : 'Party edit pending sync. It is not saved to your account until acknowledged.')
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)); await refresh() }
    finally { setBusy(false) }
  }
  const reload = () => {
    setDraft(partyDraft(row)); setBaseVersion(row.version); setDraftId(row.id); setDirty(false); setNotice(null)
    setObservedOutfits(Object.fromEntries(row.data.slots.flatMap((slot) => slot
      ? [[slot.outfitId, view.outfits.get(slot.outfitId)?.version ?? -1] as const] : [])))
  }
  const loadCloud = async () => {
    if (busy) return
    setBusy(true)
    try {
      await refreshRpgHubFromCloud()
      setDirty(false)
      await refresh()
      setNotice('Current account RPG setup loaded. Review this party before saving again.')
    } catch (reason) { setNotice(`Could not load account RPG setup: ${reason instanceof Error ? reason.message : String(reason)}`) }
    finally { setBusy(false) }
  }
  return <div className="space-y-3">
    <Link to="/rpg/parties" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-ink-soft">← All parties</Link>
    <SaveNotice message={notice ?? (pending?.status === 'conflict' ? 'Party edit conflicted. This device may have an older copy; load the current account version before editing.' : null)} />
    {pending?.status === 'conflict' && <Button variant="secondary" disabled={busy} onClick={() => void loadCloud()}>Load current account version</Button>}
    <div><p className="text-micro text-ink-soft">{row.id} · revision {row.version}</p><h2 className="mt-1 text-2xl">Edit party</h2></div>
    <label className="block text-[12px] font-semibold text-ink-soft">Party name<input value={draft.name} maxLength={40} onChange={(event) => update({ ...draft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-3 text-[15px] text-ink" /></label>
    <p className="text-[12px] leading-5 text-ink-soft">Pick enrolled outfits not assigned to another party. To move one between parties, remove it from its current party and save first.</p>
    {draft.slots.map((slot, index) => {
      const selected = slot ? profiles.get(slot.outfitId) : null
      const template = slot ? content.umas.byId.get(slot.outfitId) : null
      const skills = selected ? [...selected.tree, ...selected.legacy] : []
      return <Panel key={index} label={`Slot ${index + 1}`} className="space-y-2">
        {slot && <RpgPortrait content={content} outfitId={slot.outfitId} name={templateName(template ?? undefined, slot.outfitId)} weapon={selected?.weapon ?? null} element={slot.signature} className="aspect-square w-36" />}
        <RpgOutfitPicker view={view} draft={draft} index={index} ownedIds={Object.keys(owned)} content={content}
          onChange={(id) => { const profile = profiles.get(id); setSlot(index, profile ? { outfitId: id, signature: profile.defaultSignature, loadout: [] } : null) }} />
        {slot && selected && <><p className="text-[11px] text-ink-soft">Locked {title(selected.style)} · {RPG_WEAPON_LABELS[selected.weapon]} · Tier {selected.tier} Lv{selected.level}</p>
          <SelectField label={`Active signature for slot ${index + 1}`} value={slot.signature} options={RPG_ELEMENTS.filter((element) => canUseRpgSignature(selected, element))
            .map((element) => ({ value: element, label: `${RPG_ELEMENT_LABELS[element]} · ${selected.affinities[element]}` }))}
            onChange={(signature) => setSlot(index, { ...slot, signature })} />
          <p className="text-[11px] text-ink-soft">{slot.loadout.length}/{rpgActiveSlots(selected.level)} active skills</p>
          {skills.length > 0 && <fieldset className="space-y-1"><legend className="text-[12px] font-semibold">Skill loadout</legend>{skills.map((skill) => {
            const key = rpgSkillKey(skill)
            const checked = slot.loadout.some((ref) => rpgSkillKey(ref) === key)
            return <label key={key} className="flex min-h-11 items-center gap-2 rounded-xs border border-hairline px-2 text-[12px]"><input type="checkbox" checked={checked} onChange={() => {
              const loadout = checked ? slot.loadout.filter((ref) => rpgSkillKey(ref) !== key) : [...slot.loadout, {
                tier: skill.tier, weapon: skill.weapon, element: skill.element, depth: skill.depth, branch: skill.branch,
              }]
              setSlot(index, { ...slot, loadout })
            }} />{RPG_ELEMENT_LABELS[skill.element]} · {skill.branch} · depth {skill.depth} · skill Lv{skill.level}</label>
          })}</fieldset>}
        </>}
      </Panel>
    })}
    {problem && <p role="alert" className="text-[12px] text-danger">{problem}</p>}
    {changedOutfit && <p role="alert" className="text-[12px] text-warning">A selected outfit changed elsewhere. Reload its latest RPG profile before saving this party.</p>}
    <div className="flex gap-2"><Button variant="secondary" onClick={reload}>Reload saved</Button><Button disabled={busy || !dirty || changedOutfit || baseVersion !== row.version || Boolean(problem) || Boolean(pending && pending.status === 'pending')} className="flex-1" onClick={() => void save()}>Save party</Button></div>
    <Panel><p className="text-[13px] font-semibold">Choose a chapter from the Hub</p><p className="mt-1 text-[12px] text-ink-soft">{emptySlots(draft.slots) > 0 ? `Fill ${emptySlots(draft.slots)} more slot(s), then save before launch.` : 'Save this party, then return to the Hub to choose or resume its chapter.'}</p><Link to="/rpg" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-accent-strong">RPG Hub</Link></Panel>
    <RpgElementLegend />
  </div>
}
