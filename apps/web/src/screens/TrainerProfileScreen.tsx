import {
  badgeStateId,
  moveItem,
  moveShowcaseRefs,
  removeShowcaseGroup,
  trainerUmaAwardRef,
  type TrainerBadgePreferences,
} from '@racer/domain'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { listRaceHistory, saveBadgePreferences } from '../game/actions'
import { buildUmaBadgeCollection } from '../game/badge-collection-view'
import {
  buildStableRecentFlair,
  buildTrainerBadgeCollection,
  buildTrainerPinnedUmas,
  buildTrainerShowcase,
} from '../game/trainer-view'
import { useGame } from '../game/store'
import { BottomSheet } from '../ui/BottomSheet'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CloseIcon } from '../ui/icons'

const titleCase = (value: string) => value.split(/[-_:]/).filter(Boolean).map((part) => part[0]!.toLocaleUpperCase() + part.slice(1)).join(' ')
const dateLabel = (value: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)

export function TrainerProfileScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const error = useGame((state) => state.error)
  const umas = useGame((state) => state.umas)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const persistent = useGame((state) => state.persistent)
  const pushToast = useGame((state) => state.pushToast)
  const trainer = badges.trainer?.scope === 'trainer' ? badges.trainer : null
  const [raceHistory, setRaceHistory] = useState<Awaited<ReturnType<typeof listRaceHistory>>>([])
  const [nameOpen, setNameOpen] = useState(false)
  const [umaOpen, setUmaOpen] = useState(false)
  const [showcaseOpen, setShowcaseOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [destinationGroup, setDestinationGroup] = useState('default')
  const [groupDeleteId, setGroupDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status !== 'ready') return
    let active = true
    void listRaceHistory(10_000).then((rows) => { if (active) setRaceHistory(rows) }).catch(() => undefined)
    return () => { active = false }
  }, [status])

  const collection = useMemo(() => contentState.status === 'ready' && trainer
    ? buildTrainerBadgeCollection(contentState.content, trainer, umas, raceHistory) : null,
  [contentState, raceHistory, trainer, umas])
  const pinnedUmas = useMemo(() => contentState.status === 'ready' && trainer
    ? buildTrainerPinnedUmas(contentState.content, trainer, umas) : [], [contentState, trainer, umas])
  const showcase = useMemo(() => contentState.status === 'ready' && trainer
    ? buildTrainerShowcase(contentState.content, trainer, badges, umas, flairEvents, raceHistory) : [],
  [badges, contentState, flairEvents, raceHistory, trainer, umas])
  const recent = useMemo(() => contentState.status === 'ready'
    ? buildStableRecentFlair(contentState.content, badges, umas, flairEvents, 8) : [],
  [badges, contentState, flairEvents, umas])
  const availablePins = useMemo(() => {
    if (contentState.status !== 'ready' || !trainer || !collection) return []
    const trainerPins = collection.items.filter((item) => item.tier !== null).map((item) => ({ ref: item.awardKey, label: item.label, owner: trainer.preferences.displayName }))
    const umaPins = Object.values(umas).flatMap((save) => {
      const state = badges[badgeStateId(save.templateId)]
      if (state?.scope !== 'uma') return []
      return buildUmaBadgeCollection(contentState.content, state, flairEvents, raceHistory).items
        .filter((item) => item.tier !== null)
        .map((item) => ({ ref: trainerUmaAwardRef(save.templateId, item.awardKey), label: item.label, owner: contentState.content.umas.byId.get(save.templateId)?.name ?? save.templateId }))
    })
    return [...trainerPins, ...umaPins].sort((left, right) => left.owner.localeCompare(right.owner) || left.label.localeCompare(right.label) || left.ref.localeCompare(right.ref))
  }, [badges, collection, contentState, flairEvents, raceHistory, trainer, umas])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to view the Trainer profile" detail="Trainer achievements stay with your private save." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before opening the Trainer profile." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <SaveErrorState detail={error} />
  if (contentState.status !== 'ready' || status !== 'ready' || !trainer || !collection) return <ScreenState title="Opening Trainer profile…" detail="Reconciling Stable achievements and records." />

  const save = async (preferences: TrainerBadgePreferences, message: string) => {
    if (busy) return
    if (message === 'Group deleted; pins moved to default' && groupDeleteId === null) {
      const deleted = trainer.preferences.showcaseGroups.find((group) => !preferences.showcaseGroups.some((candidate) => candidate.id === group.id))
      if (deleted) {
        setGroupDeleteId(deleted.id)
        return
      }
    }
    setBusy(true)
    try {
      const result = await saveBadgePreferences('trainer', preferences)
      pushToast(result.changed ? message : 'Already up to date')
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not save Trainer preferences')
    } finally {
      setBusy(false)
    }
  }
  const togglePinnedUma = (umaId: string) => {
    const ids = trainer.preferences.pinnedUmaIds.includes(umaId)
      ? trainer.preferences.pinnedUmaIds.filter((id) => id !== umaId)
      : [...trainer.preferences.pinnedUmaIds, umaId]
    void save({ ...trainer.preferences, pinnedUmaIds: ids }, ids.includes(umaId) ? 'Uma pinned' : 'Uma unpinned')
  }
  const toggleShowcase = (ref: string) => {
    const pinned = trainer.preferences.showcaseGroups.some((group) => group.awardRefs.includes(ref))
    const groups = pinned
      ? trainer.preferences.showcaseGroups.map((group) => ({ ...group, awardRefs: group.awardRefs.filter((candidate) => candidate !== ref) }))
      : moveShowcaseRefs(trainer.preferences.showcaseGroups, [ref], destinationGroup)
    void save({ ...trainer.preferences, showcaseGroups: groups }, pinned ? 'Showcase pin removed' : 'Showcase pin added')
  }
  const createGroup = (event: FormEvent) => {
    event.preventDefault()
    const name = groupName.trim()
    if (!name) return
    void save({ ...trainer.preferences, showcaseGroups: [...trainer.preferences.showcaseGroups, { id: `group-${Date.now()}`, name, awardRefs: [] }] }, 'Showcase group created')
      .then(() => setGroupName(''))
  }

  return <div className="flex flex-col gap-3 pt-2">
    <Panel className="bg-gradient-to-br from-accent-wash to-panel">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Trainer profile</p>
      <div className="mt-1 flex items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{trainer.preferences.displayName}</h1><p className="text-sm font-bold text-ink-soft">{collection.earnedCount} / {collection.visibleCount} achievements</p></div><button type="button" onClick={() => { setDraftName(trainer.preferences.displayName); setNameOpen(true) }} className="min-h-11 rounded-sm bg-panel px-3 text-sm font-semibold">Edit name</button></div>
      {!persistent && <p className="mt-2 rounded-sm bg-accent-wash p-2 text-xs font-semibold">Memory only — profile edits last for this session.</p>}
      <Link to="/badges?scope=trainer" className="mt-3 flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 font-semibold text-white">Browse Trainer achievements</Link>
    </Panel>

    <Panel>
      <h2 className="text-lg font-semibold">Stable completion</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-sm bg-panel p-3"><p className="font-semibold">Umas</p><p>{collection.counts.ownedUmas} / {collection.counts.catalogUmas}</p></div>
        <div className="rounded-sm bg-panel p-3"><p className="font-semibold">Cards</p><p>{collection.counts.ownedCards} / {collection.counts.catalogCards}</p></div>
        <div className="rounded-sm bg-panel p-3"><p className="font-semibold">Maxed cards</p><p>{collection.counts.maxedCards} / {collection.counts.catalogCards}</p></div>
        <div className="rounded-sm bg-panel p-3"><p className="font-semibold">Badge stages</p><p>{collection.counts.badgeStages}</p></div>
      </div>
    </Panel>

    <Panel>
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Pinned Umas</h2><p className="text-xs text-ink-soft">Owned Umas in your chosen order</p></div><button type="button" onClick={() => setUmaOpen(true)} className="min-h-11 rounded-sm bg-panel px-3 text-sm font-semibold">Manage</button></div>
      <div className="mt-3 grid gap-2">{pinnedUmas.map((item, index) => <div key={item.umaId} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', item.umaId)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const moving = trainer.preferences.pinnedUmaIds.indexOf(event.dataTransfer.getData('text/plain')); if (moving >= 0) void save({ ...trainer.preferences, pinnedUmaIds: moveItem(trainer.preferences.pinnedUmaIds, moving, index) }, 'Pinned Umas reordered') }} className="flex min-h-12 items-center gap-2 rounded-sm bg-panel px-3"><Link to={`/stable/${encodeURIComponent(item.umaId)}`} className="min-w-0 flex-1 py-3"><span className="block truncate font-semibold">{item.name}</span><span className="block text-xs text-ink-soft">Lv {item.level}{item.missingContent ? ' · content missing' : ''}</span></Link><button type="button" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => void save({ ...trainer.preferences, pinnedUmaIds: moveItem(trainer.preferences.pinnedUmaIds, index, index - 1) }, 'Pinned Umas reordered')} className="min-h-11 min-w-11 font-semibold"><ArrowUpIcon size={20} className="mx-auto" /></button><button type="button" aria-label={`Move ${item.name} down`} disabled={index === pinnedUmas.length - 1} onClick={() => void save({ ...trainer.preferences, pinnedUmaIds: moveItem(trainer.preferences.pinnedUmaIds, index, index + 1) }, 'Pinned Umas reordered')} className="min-h-11 min-w-11 font-semibold"><ArrowDownIcon size={20} className="mx-auto" /></button></div>)}</div>
      {pinnedUmas.length === 0 && <p className="mt-3 text-sm text-ink-soft">Pin favorite Umas to build this profile strip.</p>}
    </Panel>

    <Panel>
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Trainer showcase</h2><p className="text-xs text-ink-soft">Achievements and earned Uma flair</p></div><button type="button" onClick={() => setShowcaseOpen(true)} className="min-h-11 rounded-sm bg-panel px-3 text-sm font-semibold">Manage</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2">{showcase.map((item) => <div key={item.ref} className="[content-visibility:auto] min-h-24 rounded-sm border-2 border-accent/40 bg-panel p-3"><p className="text-xs font-semibold uppercase text-accent-strong">{item.ownerLabel}</p><p className="font-semibold leading-tight">{item.label}</p><p className="mt-1 text-xs font-bold text-ink-soft">{item.missing ? 'Missing content' : titleCase(item.tier ?? 'earned')}</p></div>)}</div>
      {showcase.length === 0 && <p className="mt-3 text-sm text-ink-soft">Choose Trainer achievements or earned Uma flair to tell the Stable’s story.</p>}
    </Panel>

    <Panel>
      <h2 className="text-lg font-semibold">Stable records</h2>
      <div className="mt-3 grid gap-2">{collection.records.map((record) => <div key={record.kind} className="rounded-sm bg-panel p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{record.label}</p><p className="text-xs text-ink-soft">{record.umaName}</p></div><p className="font-semibold text-accent-strong">{record.valueLabel}</p></div>{record.source?.to ? <Link to={record.source.to} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong">{record.source.label} →</Link> : record.source && <p className="mt-1 text-xs text-ink-soft">{record.source.label} · {record.source.safeId}</p>}</div>)}</div>
      {collection.records.length === 0 && <p className="mt-3 text-sm text-ink-soft">Race and train to establish Stable records.</p>}
    </Panel>

    <Panel>
      <h2 className="text-lg font-semibold">Recent Stable flair</h2>
      <div className="mt-3 grid gap-2">{recent.map((item) => <Link key={item.id} to={item.to} className="flex min-h-12 items-center justify-between gap-3 rounded-sm bg-panel p-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.label}</span><span className="block text-xs text-ink-soft">{item.ownerLabel} · {titleCase(item.stage)}</span></span><time className="shrink-0 text-[10px] font-bold">{dateLabel(item.earnedAt)}</time></Link>)}</div>
    </Panel>

    <BottomSheet open={nameOpen} onClose={() => setNameOpen(false)}><form onSubmit={(event) => { event.preventDefault(); void save({ ...trainer.preferences, displayName: draftName }, 'Trainer name updated').then(() => setNameOpen(false)) }}><h2 className="text-xl font-semibold">Edit Trainer name</h2><input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={32} className="mt-3 min-h-11 w-full rounded-sm bg-panel px-3 font-bold" /><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setNameOpen(false)} className="min-h-11 rounded-sm bg-panel font-semibold">Cancel</button><button disabled={busy || !draftName.trim()} className="min-h-11 rounded-sm bg-accent font-semibold text-white disabled:opacity-45">Confirm</button></div></form></BottomSheet>

    <BottomSheet open={umaOpen} onClose={() => setUmaOpen(false)}><div className="max-h-[76dvh] overflow-y-auto"><h2 className="text-xl font-semibold">Manage pinned Umas</h2><div className="mt-3 grid gap-2">{Object.values(umas).sort((left, right) => left.templateId.localeCompare(right.templateId)).map((uma) => { const name = contentState.content.umas.byId.get(uma.templateId)?.name ?? uma.templateId; const pinned = trainer.preferences.pinnedUmaIds.includes(uma.templateId); return <button key={uma.templateId} type="button" disabled={busy} aria-pressed={pinned} onClick={() => togglePinnedUma(uma.templateId)} className={`min-h-12 rounded-sm border-2 px-3 text-left font-semibold ${pinned ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}>{pinned && <CheckIcon size={16} className="mr-1 inline" title="Pinned" />}{name}<span className="block text-xs text-ink-soft">Lv {uma.level}</span></button> })}</div></div></BottomSheet>

    <BottomSheet open={showcaseOpen} onClose={() => setShowcaseOpen(false)}><div className="max-h-[76dvh] overflow-y-auto"><h2 className="text-xl font-semibold">Manage Trainer showcase</h2><label className="mt-3 block text-xs font-bold">Destination group<select value={destinationGroup} onChange={(event) => setDestinationGroup(event.target.value)} className="mt-1 min-h-11 w-full rounded-sm bg-panel px-3 font-semibold">{trainer.preferences.showcaseGroups.map((group) => <option key={group.id} value={group.id}>{group.name ?? 'Default showcase'}</option>)}</select></label><form onSubmit={createGroup} className="mt-3 flex gap-2"><input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={40} placeholder="New group" className="min-h-11 min-w-0 flex-1 rounded-sm bg-panel px-3 font-bold" /><button disabled={!groupName.trim() || trainer.preferences.showcaseGroups.length >= 21} className="min-h-11 rounded-sm bg-accent px-3 font-semibold text-white disabled:opacity-45">Add</button></form><div className="mt-3 grid gap-3">{trainer.preferences.showcaseGroups.map((group, groupIndex) => <div key={group.id} className="rounded-sm bg-panel p-3"><div className="flex items-center gap-1"><p className="min-w-0 flex-1 truncate font-semibold">{group.name ?? 'Default showcase'} · {group.awardRefs.length}</p><button type="button" aria-label={`Move ${group.name ?? 'default'} up`} disabled={groupIndex <= 1} onClick={() => void save({ ...trainer.preferences, showcaseGroups: moveItem(trainer.preferences.showcaseGroups, groupIndex, groupIndex - 1) }, 'Groups reordered')} className="min-h-11 min-w-11"><ArrowUpIcon size={20} className="mx-auto" /></button><button type="button" aria-label={`Move ${group.name ?? 'default'} down`} disabled={groupIndex === 0 || groupIndex === trainer.preferences.showcaseGroups.length - 1} onClick={() => void save({ ...trainer.preferences, showcaseGroups: moveItem(trainer.preferences.showcaseGroups, groupIndex, groupIndex + 1) }, 'Groups reordered')} className="min-h-11 min-w-11"><ArrowDownIcon size={20} className="mx-auto" /></button>{group.id !== 'default' && <button type="button" aria-label={`Delete ${group.name}`} onClick={() => void save({ ...trainer.preferences, showcaseGroups: removeShowcaseGroup(trainer.preferences.showcaseGroups, group.id, 'move-to-default') }, 'Group deleted; pins moved to default')} className="min-h-11 min-w-11 text-danger"><CloseIcon size={20} className="mx-auto" /></button>}</div>{group.awardRefs.map((ref, index) => <div key={ref} className="mt-1 flex min-h-11 items-center gap-1 rounded-lg bg-accent-wash px-2"><span className="min-w-0 flex-1 truncate text-xs font-bold">{showcase.find((item) => item.ref === ref)?.label ?? ref}</span><button type="button" aria-label={`Move ${ref} up`} disabled={index === 0} onClick={() => { const groups = trainer.preferences.showcaseGroups.map((candidate) => candidate.id === group.id ? { ...candidate, awardRefs: moveItem(candidate.awardRefs, index, index - 1) } : candidate); void save({ ...trainer.preferences, showcaseGroups: groups }, 'Pins reordered') }} className="min-h-11 min-w-11"><ArrowUpIcon size={20} className="mx-auto" /></button><button type="button" aria-label={`Move ${ref} down`} disabled={index === group.awardRefs.length - 1} onClick={() => { const groups = trainer.preferences.showcaseGroups.map((candidate) => candidate.id === group.id ? { ...candidate, awardRefs: moveItem(candidate.awardRefs, index, index + 1) } : candidate); void save({ ...trainer.preferences, showcaseGroups: groups }, 'Pins reordered') }} className="min-h-11 min-w-11"><ArrowDownIcon size={20} className="mx-auto" /></button></div>)}</div>)}</div><h3 className="mt-4 font-semibold">Available earned flair</h3><div className="mt-2 grid gap-2">{availablePins.map((item) => { const pinned = trainer.preferences.showcaseGroups.some((group) => group.awardRefs.includes(item.ref)); return <button key={item.ref} type="button" disabled={busy} aria-pressed={pinned} onClick={() => toggleShowcase(item.ref)} className={`min-h-12 rounded-sm border-2 px-3 text-left ${pinned ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}><span className="font-semibold">{pinned && <CheckIcon size={16} className="mr-1 inline" title="Pinned" />}{item.label}</span><span className="block text-xs text-ink-soft">{item.owner}</span></button> })}</div></div></BottomSheet>

    <BottomSheet open={groupDeleteId !== null} onClose={() => setGroupDeleteId(null)}>
      <h2 className="text-xl font-semibold">Delete this group?</h2>
      <p className="mt-2 text-sm text-ink-soft">Choose what happens to its pins. Earned flair is never deleted.</p>
      <div className="mt-3 grid gap-2">
        <button type="button" disabled={busy || groupDeleteId === null} onClick={() => { if (!groupDeleteId) return; void save({ ...trainer.preferences, showcaseGroups: removeShowcaseGroup(trainer.preferences.showcaseGroups, groupDeleteId, 'move-to-default') }, 'Group deleted; pins moved to default').then(() => setGroupDeleteId(null)) }} className="min-h-11 rounded-sm bg-accent px-3 font-semibold text-white disabled:opacity-45">Move pins to default</button>
        <button type="button" disabled={busy || groupDeleteId === null} onClick={() => { if (!groupDeleteId) return; void save({ ...trainer.preferences, showcaseGroups: removeShowcaseGroup(trainer.preferences.showcaseGroups, groupDeleteId, 'unpin') }, 'Group and pins removed').then(() => setGroupDeleteId(null)) }} className="min-h-11 rounded-sm bg-danger/10 px-3 font-semibold text-danger disabled:opacity-45">Unpin and delete</button>
      </div>
    </BottomSheet>
  </div>
}
