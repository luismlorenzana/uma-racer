// DEV-only read-only layout proof; no database, transport, enrollment or rewards.
import { useState } from 'react'
import { changeRpgClass, type RpgPresetSaveV1, type RpgProfile } from '@racer/domain'
import { RpgClassEditor } from '../../ui/rpg/RpgClassEditor'
import { RpgGuide } from './RpgGuide'
import { RpgHubContent, RpgOutfitPicker, RpgRosterContent } from './RpgScreen'
import { releaseProofFixture, releaseProofNames } from './release-proof-fixture'
const fixture = releaseProofFixture()
const names: Record<string, string> = { ...releaseProofNames, 'free-0': 'Aster', 'free-1': 'Fern', 'free-2': 'Gale', 'free-3': 'Lumen',
  'new-0': 'Apple', 'new-1': 'Clover', 'new-2': 'Mist', 'new-3': 'Willow' }
const outfits = new Map(fixture.view.outfits)
for (const [index, saved] of [...outfits.values()].slice(0, 4).entries()) {
  const id = `free-${index}`
  outfits.set(id, { ...saved, id, data: { ...saved.data, profile: { ...saved.data.profile, outfitId: id } } })
}
const view = { ...fixture.view, outfits }
export function RpgReleaseProofScreen() {
  const [guide, setGuide] = useState(false)
  const [page, setPage] = useState<'Hub' | 'Roster' | 'Picker' | 'Class'>('Hub')
  const [profile, setProfile] = useState<RpgProfile>(() => {
    const p = [...view.outfits.values()][0]!.data.profile
    return { ...p, tier: 1, level: 1, exp: 65, tree: [], legacy: [], sourceAptitudes: {
      ...p.sourceAptitudes, strategy: { ...p.sourceAptitudes.strategy, front: 'A' as const, pace: 'A' as const } } }
  })
  const [draft, setDraft] = useState<RpgPresetSaveV1>(() => structuredClone(view.presets[1]!.data))
  return <div className="flex h-dvh flex-col bg-page">
    <header className="pt-safe shrink-0 border-b border-hairline bg-panel px-4"><div className="flex min-h-14 items-center justify-between gap-2"><h1 className="font-display text-xl">Uma RPG</h1><button className="min-h-11 rounded-sm border border-hairline px-3 text-xs" onClick={() => setGuide(true)}>How to play</button></div><p className="pb-2 text-[11px] text-ink-soft">DEV · invented portraits · no account writes</p>
      <nav className="mb-2 grid grid-cols-4 gap-1 rounded-sm bg-sunken p-1" aria-label="Proof views">{(['Hub', 'Roster', 'Picker', 'Class'] as const).map(label => <button key={label} className={`min-h-11 rounded-xs text-xs font-semibold ${page === label ? 'bg-panel shadow-1' : ''}`} onClick={() => setPage(label)}>{label}</button>)}</nav>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-safe">
      {page === 'Hub' && <RpgHubContent view={view} content={null} ownedIds={Object.keys(names)} names={names} release={fixture.release} retryRelease={() => undefined} />}
      {page === 'Roster' && <RpgRosterContent view={view} content={null} ownedIds={Object.keys(names)} names={names} />}
      {page === 'Class' && <div className="space-y-3"><h2 className="text-2xl">Aster · RPG Lv1</h2><p className="text-xs text-ink-soft">Tier 1 · 65 EXP · memory-only class correction</p>
        <RpgClassEditor profile={profile} blocked={null} onChange={async (style, weapon) => { setProfile(changeRpgClass(profile, style, weapon)) }} /></div>}
      {page === 'Picker' && <div className="space-y-3"><h2 className="text-2xl">Edit party</h2><p className="text-xs leading-5 text-ink-soft">Crossroads party holds five outfits. Only its four unassigned peers are offered here. Draft choices are memory-only.</p>
        {draft.slots.map((_, index) => <div key={index} className="rounded-md border border-hairline bg-panel p-3"><RpgOutfitPicker view={view} draft={draft} index={index} content={null} ownedIds={Object.keys(names)} names={names} onChange={id => {
          const profile = view.outfits.get(id)?.data.profile
          const slots = [...draft.slots] as RpgPresetSaveV1['slots']
          slots[index] = profile ? { outfitId: id, signature: profile.defaultSignature, loadout: [] } : null
          setDraft({ ...draft, slots })
        }} /></div>)}
      </div>}
    </main>
    {guide && <RpgGuide onClose={() => setGuide(false)} proof />}
  </div>
}
