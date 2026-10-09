// Owned compact roster, explicit registration and frozen-source profile (docs/design/uma-puzzles.md §§3–4,9).
import { PUZZLE_ACTIVES, PUZZLE_ELEMENTS, PUZZLE_LEADERS, STRATEGIES, nextPuzzleLevelExp, puzzleKitChoices, puzzleStats, type PuzzleElement } from '@racer/domain'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { openPuzzleParty, puzzleColourCounts, puzzleRoster, suggestedPuzzleElement, type PuzzleRosterEntry } from '../../game/puzzles/presentation'
import { PuzzleButton, PuzzleCard, PuzzleOutfitIcon, PUZZLE_STYLE_LABEL } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { PuzzleKitEditor, puzzleActiveLabel, puzzleLeaderLabel } from '../../ui/puzzles/kit'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
export function PuzzleRosterScreen() {
  const { ownedIds, content, root } = usePuzzles(), account = usePuzzleAccount()
  const [element, setElement] = useState<PuzzleElement | 'all'>('all'), [style, setStyle] = useState('all')
  const roster = account ? puzzleRoster(ownedIds, content.umas.byId, account, content.manifest.version, element, style) : []
  const chip = (active: boolean) => `flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-sm border px-2 text-xs ${active ? 'border-accent bg-accent/10 text-accent' : 'border-hairline-dark text-ink-on-dark-soft'}`
  return <PuzzleFrame title="Puzzle roster" back={root}><div className="grid gap-3"><div role="group" aria-label="Roster filters" className="flex gap-1 overflow-x-auto pb-1">
    <button className={chip(element === 'all' && style === 'all')} aria-pressed={element === 'all' && style === 'all'} onClick={() => { setElement('all'); setStyle('all') }}>All</button>
    {PUZZLE_ELEMENTS.map(e => <button key={e} aria-label={`Element: ${e}`} aria-pressed={element === e} className={chip(element === e)} onClick={() => setElement(element === e ? 'all' : e)}><PuzzleElementMark element={e} /></button>)}
    {STRATEGIES.map(s => <button key={s} aria-label={`Original A style: ${PUZZLE_STYLE_LABEL[s]}`} aria-pressed={style === s} className={chip(style === s)} onClick={() => setStyle(style === s ? 'all' : s)}>{PUZZLE_STYLE_LABEL[s]}</button>)}
  </div><p className="text-xs text-ink-on-dark-soft">Highest Puzzle Level first; filters use original aptitudes only.</p>
    {[true, false].map(enrolled => { const entries = roster.filter(e => Boolean(e.outfit) === enrolled)
      return <section key={String(enrolled)} aria-label={enrolled ? 'Enrolled' : 'Not enrolled'}><h2 className="mb-2 text-sm">{enrolled ? 'Enrolled' : 'Not enrolled'} · {entries.length}</h2>
    <div className="grid grid-cols-5 gap-x-2 gap-y-4">{entries.map(entry => <Link key={entry.id} to={`${root}/roster/${encodeURIComponent(entry.id)}`} className="min-h-11 rounded-sm focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${entry.name}, ${entry.outfit ? `${entry.outfit.enrollment.element}, Puzzle Level ${entry.outfit.enrollment.level}` : entry.unavailable ?? 'not enrolled'}`}>
      <PuzzleOutfitIcon id={entry.id} name={entry.name} content={content} outfit={entry.outfit} /><p className="mt-1 truncate text-[10px] text-center">{entry.name}</p>
      <p className="text-center text-[10px] text-ink-on-dark-soft">{entry.outfit ? `PL ${entry.outfit.enrollment.level}` : entry.unavailable ? 'Unavailable' : 'Enroll'}</p>
    </Link>)}</div></section>})}{!roster.length && <PuzzleCard>No owned outfits match these filters.</PuzzleCard>}
  </div></PuzzleFrame>
}
function SourceDetails({ entry }: { entry: PuzzleRosterEntry }) {
  if (!entry.source) return null
  return <PuzzleCard><h2 className="text-sm font-semibold">Original, frozen identity</h2><div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">{STRATEGIES.map(s => <div key={s}><p className="text-ink-on-dark-soft">{PUZZLE_STYLE_LABEL[s]}</p><p>{entry.source!.aptitudes.strategy[s]}</p></div>)}</div>
    <p className="mt-2 text-xs text-ink-on-dark-soft">Turf {entry.source.aptitudes.surface.turf} · Dirt {entry.source.aptitudes.surface.dirt}</p>
    <p className="mt-1 break-all text-[10px] text-ink-on-dark-soft">Source {entry.source.templateId} · {entry.source.contentVersion} · rules {entry.source.rulesVersion}</p></PuzzleCard>
}
export function PuzzleProfileScreen() {
  const { outfitId = '' } = useParams(), { root, ownedIds, content, host, command, busy } = usePuzzles(), account = usePuzzleAccount()
  const [search] = useSearchParams()
  const [selected, setSelected] = useState<PuzzleElement | null>(null)
  useEffect(() => { setSelected(null) }, [outfitId])
  const entry = account ? puzzleRoster(ownedIds, content.umas.byId, account, content.manifest.version).find(e => e.id === outfitId) : null
  const outfit = entry?.outfit, source = entry?.source, level = outfit?.enrollment.level ?? 1
  const stats = source && puzzleStats(source, level), next = source && puzzleStats(source, level + 1)
  const assigned = account?.parties.find(p => p.slots.some(s => s?.outfitId === outfitId)), open = account && assigned && openPuzzleParty(account, assigned.partyId)
  const locked = Boolean(outfit?.enrollment.firstBattleId), counts = account && puzzleColourCounts(account), suggested = entry && account && suggestedPuzzleElement(entry.elements, account)
  const choices = source && puzzleKitChoices(source, level)
  const fromParty = account?.parties.find(p => p.partyId === search.get('party') && p.slots.some(s => s?.outfitId === outfitId))
  const exp = outfit?.enrollment.exp ?? 0, expNeeded = nextPuzzleLevelExp(level)
  return <PuzzleFrame title={entry?.name ?? 'Outfit unavailable'} back={fromParty ? `${root}/party/${fromParty.partyId}` : `${root}/roster`} backLabel={fromParty?.name}><div className="grid gap-3">
    {fromParty && <nav aria-label={`${fromParty.name} members`} className="grid grid-cols-5 gap-2">{fromParty.slots.map((slot, index) => slot ? <Link key={index} to={`${root}/roster/${encodeURIComponent(slot.outfitId)}?party=${fromParty.partyId}`}
      aria-label={`Profile: ${content.umas.byId.get(slot.outfitId)?.name ?? slot.outfitId}`} aria-current={slot.outfitId === outfitId ? 'page' : undefined}
      className={`min-h-11 rounded-md ${slot.outfitId === outfitId ? 'ring-2 ring-accent' : 'opacity-55'}`}><PuzzleOutfitIcon id={slot.outfitId} name={content.umas.byId.get(slot.outfitId)?.name ?? slot.outfitId} content={content} outfit={account?.outfits.find(o => o.outfitId === slot.outfitId)} leader={index === 0} /></Link> : <span key={index} aria-label={`Empty slot ${index + 1}`} className="aspect-square rounded-md border border-dashed border-hairline-dark" />)}</nav>}
    {!entry ? <PuzzleCard>This outfit is not owned. Return to your roster.</PuzzleCard> : <>
      <div className="flex items-center gap-3"><div className="w-20 shrink-0"><PuzzleOutfitIcon id={entry.id} name={entry.name} content={content} outfit={outfit} /></div><div className="min-w-0 flex-1"><p className="text-lg">Puzzle Level {level}</p><p className="text-xs text-ink-on-dark-soft">{outfit ? `${exp}/${expNeeded} EXP` : 'Enrollment starts at PL 1 · 0 EXP'}</p>
        <div role="progressbar" aria-label="Puzzle EXP" aria-valuemin={0} aria-valuemax={expNeeded} aria-valuenow={exp} className="mt-1 h-2 overflow-hidden rounded-full bg-stage-soft"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, exp / expNeeded * 100)}%` }} /></div>
        <p className="mt-1 text-xs">{outfit ? <><span className="capitalize">{outfit.enrollment.element}</span> · {locked ? 'Element locked at first entry' : 'Element correctable before entry'}</> : 'Choose an element to enroll'}</p>{assigned && <p className="mt-1 text-xs text-ink-on-dark-soft">In {assigned.name}</p>}</div></div>
      <SourceDetails entry={entry} />
      {entry.unavailable && <PuzzleCard><p role="status">{entry.unavailable}</p></PuzzleCard>}
      {stats && next && <PuzzleCard><h2 className="text-sm font-semibold">Party contributions · next-level gains</h2><dl className="mt-2 grid grid-cols-3 gap-3">{Object.entries(stats).map(([key, value]) => <div key={key}><dt className="text-[10px] uppercase text-ink-on-dark-soft">{key}</dt><dd className="text-base">{value}<span className="ml-1 text-xs text-accent">+{next[key as keyof typeof next] - value}</span></dd></div>)}</dl></PuzzleCard>}
      {source && choices && !entry.unavailable && <PuzzleCard><h2 className="text-sm font-semibold">{outfit ? 'Default kit' : 'Eligible actives'}</h2>
        {outfit ? <><div className="mt-2"><PuzzleKitEditor outfit={outfit} kit={outfit.kit} disabled={busy || Boolean(open)} onChange={kit => { void command(`kit:${outfitId}:${outfit.revision}:${JSON.stringify(kit)}`, id => host.equip(outfitId, kit, outfit.revision, id)) }} /></div><p className="mt-2 text-xs text-ink-on-dark-soft">New party assignments copy this kit. Existing party slots keep their own loadout.{open ? ' An open fight locks kit changes.' : ''}</p></> : <ul className="mt-2 grid gap-2 text-xs">{PUZZLE_ACTIVES.filter(a => choices.actives.includes(a.id)).map(a => <li key={a.id}>{puzzleActiveLabel(a.id)}</li>)}</ul>}
        <p className="mt-3 text-xs text-ink-on-dark-soft">Leader choices</p>{PUZZLE_LEADERS.filter(l => choices.leaders.includes(l.id)).map(l => <p className="mt-1 text-xs" key={l.id}>{puzzleLeaderLabel(l.id)}</p>)}
      </PuzzleCard>}
      {source && !entry.unavailable && (!outfit || !locked) && <PuzzleCard><h2 className="text-sm font-semibold">{outfit ? 'Correct enrollment' : 'Register element'}</h2>
        <p className="mt-2 text-xs text-ink-on-dark-soft">{source.aptitudes.surface.dirt === 'A' ? 'Original Dirt A allows any of the five elements.' : entry.elements.length === 1 ? `This original A-style combination permits only ${entry.elements[0]}.` : 'This original A-style combination permits Fire, Water or Wood.'}</p>
        <p className="mt-2 text-xs">{suggested ? `Roster balance suggestion: ${suggested}. This is advice, not a selection.` : ''}</p>
        <div className="mt-3 flex flex-wrap gap-2">{entry.elements.map(e => <button key={e} type="button" aria-pressed={selected === e} onClick={() => setSelected(e)} disabled={busy || Boolean(open)} className={`flex min-h-11 min-w-11 items-center gap-1 rounded-sm border px-2 text-xs ${selected === e ? 'border-accent bg-stage' : 'border-hairline-dark'}`}><PuzzleElementMark element={e} /><span className="capitalize">{e}</span><span className="text-ink-on-dark-soft">{counts?.[e] ?? 0}</span></button>)}</div>
        <p className="mt-3 text-xs text-ink-on-dark-soft">First battle entry permanently locks the element, including after a loss or abandonment. Other modes are unchanged.</p>
        <PuzzleButton className="mt-3 w-full" disabled={!selected || busy || Boolean(open) || outfit?.enrollment.element === selected} onClick={() => { if (!selected) return; const e = selected;
          void command(`register:${outfitId}:${outfit?.revision ?? 0}:${e}`, async id => { await host.registration(outfitId); return outfit ? host.correct(outfitId, e, outfit.revision, id) : host.enroll(outfitId, e, id) }).then(ok => { if (ok) setSelected(null) }) }}>Confirm {outfit ? 'correction' : 'enrollment'}</PuzzleButton>
      </PuzzleCard>}
      {locked && <PuzzleCard><p className="text-xs text-ink-on-dark-soft">First entry: <span className="break-all">{outfit?.enrollment.firstBattleId}</span>. Changing party, losing or abandoning does not undo this lock.</p></PuzzleCard>}
      <Link className="flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark" to={root}>Back to parties</Link>
    </>}
  </div></PuzzleFrame>
}
