// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter } from 'react-router'
import { rpgRewardProjection } from '@racer/domain'
import { syntheticChapterProfiles } from '../../../../../packages/domain/src/rpg/chapter.synthetic'
import { RacerDb } from '../../game/db'
import { RpgProgressionHost } from '../../game/rpg-progression-host'
import { RpgProgressionEditor } from './RpgProgressionEditor'
import { RpgRewardReveal } from './RpgRewardReveal'
const db = new RacerDb('test-rpg-progression-ui'), host = new RpgProgressionHost(db)
const outfitId = 'test-outfit-0'
const mount = (element: React.ReactNode) => render(<LazyMotion strict features={domAnimation}><MemoryRouter>{element}</MemoryRouter></LazyMotion>)
describe('RPG progression phone controls', () => {
  beforeEach(async () => {
    await db.delete(); await db.open()
    await db.rpgOutfits.put({ id: outfitId, version: 1, data: { schemaVersion: 1, profile: syntheticChapterProfiles()[0]!, projectionRevision: 0 } })
  })
  afterEach(() => { cleanup(); db.close() })
  it('offers only frozen A styles, edits both class and weapon, and waits for acknowledgement', async () => {
    const row = (await db.rpgOutfits.get(outfitId))!
    await db.rpgOutfits.put({ ...row, data: { ...row.data, profile: { ...row.data.profile, level: 1, exp: 65,
      tree: [], sourceAptitudes: { ...row.data.profile.sourceAptitudes,
        strategy: { front: 'A', pace: 'A', late: 'B', end: 'G' } } } } })
    const sync = vi.fn()
    mount(<RpgProgressionEditor host={host} outfitId={outfitId} onSync={sync} />)
    const trigger = await screen.findByRole('button', { name: 'Edit class' })
    trigger.focus(); fireEvent.click(trigger)
    const style = screen.getByRole('combobox', { name: 'A running-style class' }) as HTMLSelectElement
    expect([...style.options].map(o => o.value)).toEqual(['front', 'pace'])
    expect((screen.getByRole('button', { name: 'Save class' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(style, { target: { value: 'pace' } })
    const weapon = screen.getByRole('combobox', { name: 'Weapon path' }) as HTMLSelectElement
    expect([...weapon.options].map(o => o.value)).toEqual(['spear', 'sword-shield'])
    fireEvent.change(weapon, { target: { value: 'sword-shield' } })
    expect(screen.getByText(/your 65 EXP, stats, affinities and party slots stay unchanged/)).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save class' })
    save.focus(); fireEvent.keyDown(save, { key: 'Tab' }); expect(document.activeElement).toBe(style)
    fireEvent.click(save); fireEvent.click(save)
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.weapon).toBe('greatsword')
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.exp).toBe(65)
    const queued = (await db.pendingRpgCommands.toArray())[0]!
    expect(queued.body).toMatchObject({ action: 'edit-outfit', upserts: [{ data: {
      profile: { style: 'pace', weapon: 'sword-shield', exp: 65 }, projectionRevision: 1 } }] })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    await screen.findByText(/Nothing provisional can fund/)
    expect((screen.getByRole('button', { name: 'Edit class' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it.each([{ tier: 1, level: 2 }, { tier: 2, level: 1 }])('has no class edit for progressed profiles %j', async ({ tier, level }) => {
    const row = (await db.rpgOutfits.get(outfitId))!
    await db.rpgOutfits.put({ ...row, data: { ...row.data, profile: { ...row.data.profile, tier, level, tree: [] } } })
    mount(<RpgProgressionEditor host={host} outfitId={outfitId} onSync={() => {}} />)
    await screen.findByText('Locked class identity')
    expect(screen.queryByRole('button', { name: 'Edit class' })).toBeNull()
  })
  it('shows all target/hit/support branches and queues one point without projecting it', async () => {
    const sync = vi.fn()
    mount(<RpgProgressionEditor host={host} outfitId={outfitId} onSync={sync} showProfile />)
    await screen.findByRole('heading', { name: 'Elemental skill trees' })
    expect(screen.getByText(/Focused/)).toBeTruthy(); expect(screen.getByText(/Area/)).toBeTruthy()
    expect(screen.getByText(/Committed/)).toBeTruthy(); expect(screen.getByText(/Multi-hit/)).toBeTruthy()
    const learn = screen.getAllByRole('button', { name: 'Learn' }).find((b) => !(b as HTMLButtonElement).disabled)!
    fireEvent.click(learn); fireEvent.click(learn)
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.tree).toHaveLength(1)
    expect(await db.pendingRpgCommands.count()).toBe(1)
    await screen.findByText(/Nothing provisional can fund/)
    expect(screen.getAllByRole('button', { name: 'Learn' }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })
  it('promotion previews every stat and bank, requires explicit discard, traps focus and restores it', async () => {
    const row = (await db.rpgOutfits.get(outfitId))!
    await db.rpgOutfits.put({ ...row, data: { ...row.data, profile: { ...row.data.profile, level: 50, exp: 657 } } })
    mount(<RpgProgressionEditor host={host} outfitId={outfitId} onSync={() => {}} showProfile />)
    const trigger = await screen.findByRole('button', { name: 'Review Tier 2 promotion' })
    trigger.focus(); fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Confirm class promotion' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Confirm promotion' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Discard 24 unspent/ }))
    expect(screen.getByText('Tier 1 Lv50 → Tier 2 Lv5')).toBeTruthy()
    expect(screen.getByText('657 banked EXP applied · 17 EXP left')).toBeTruthy()
    expect(screen.getByText(/speed:.*→/)).toBeTruthy(); expect(screen.getByText(/wit:.*→/)).toBeTruthy()
    const last = screen.getByRole('button', { name: 'Confirm promotion' }); last.focus(); fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getAllByRole('checkbox')[0])
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
  it('renders five receipt deltas, all crossed levels and stats; pending has no profile/spend CTA', () => {
    const profiles = syntheticChapterProfiles(), memberExp = profiles.map((p) => rpgRewardProjection(p, 4000).member)
    const evidence = { schemaVersion: 1 as const, resultId: 'result', entryId: 'entry', retryOrdinal: 0, outcome: 'win' as const,
      stateHash: 'a'.repeat(64), contentHash: 'b'.repeat(64), contentVersion: 'test', memberExp, createdAt: 1 }
    mount(<RpgRewardReveal evidence={evidence} profiles={profiles} pending content={null} name={(id) => id} profileLink={(id) => `/rpg/roster/${id}`} />)
    expect(screen.getAllByText('+4000 RPG EXP · unearned')).toHaveLength(5)
    expect(screen.getAllByText(/Levels crossed: Lv11 · Lv12/)).toHaveLength(5)
    expect(screen.getAllByText('Speed · ATK/MATK')).toHaveLength(5)
    expect(screen.getAllByText('Wit · MP')).toHaveLength(5)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
