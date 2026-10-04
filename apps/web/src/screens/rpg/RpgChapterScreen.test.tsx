// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syntheticChapterPack, syntheticChapterProfiles } from '../../../../../packages/domain/src/rpg/chapter.synthetic'
import type { RpgCheckpointSaveV1, RpgPresetSaveV1 } from '@racer/domain'
import type { RpgChapterHost, RpgChapterView } from '../../game/rpg-chapter-host'
import { RpgChapterMap } from './RpgChapterScreen'
vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }))
afterEach(cleanup)
const profiles = syntheticChapterProfiles(), pack = syntheticChapterPack(), chapter = pack.chapters[0]!
const cp: RpgCheckpointSaveV1 = { schemaVersion: 1, presetId: 'party-1', chapterId: chapter.id, contentVersion: pack.version, contentHash: pack.contentHash,
  attemptIndex: 1, attemptId: 'rpg-attempt:party-1:test-chapter:1', selectedPath: ['opening', 'fork'], lastClearedNodeId: 'fork', status: 'at-checkpoint', revision: 3, frozenEntry: null }
function view(): RpgChapterView {
  const preset: RpgPresetSaveV1 = { schemaVersion: 1, presetId: 'party-1', name: 'Test party', foregroundChapterId: chapter.id,
    slots: profiles.map((p) => ({ outfitId: p.outfitId, signature: p.defaultSignature, loadout: [] })) as unknown as RpgPresetSaveV1['slots'] }
  return { pack, chapter, unavailable: null, preset: { id: 'party-1', version: 1, data: preset }, checkpoint: { id: 'party-1:test-chapter', version: 4, data: cp },
    outfits: profiles.map((p) => ({ id: p.outfitId, version: 1, data: { schemaVersion: 1, profile: p, projectionRevision: 0 } })), checkpoints: [], pending: [], tokenGrants: [] }
}
function mount(value = view()) {
  const choose = vi.fn(async () => 'map'), advance = vi.fn(async () => {}), onBattle = vi.fn()
  // Read-only port stub isolates map rendering; host/server lifecycle is covered by rpg-chapter-host.test.ts.
  const host = { read: async () => value, choose, advance } as unknown as RpgChapterHost
  render(<LazyMotion features={domAnimation} strict><MemoryRouter><RpgChapterMap host={host} presetId="party-1" chapterId={chapter.id}
    uid="test-account" content={null} proof onSync={() => {}} onSelect={() => {}} onBattle={onBattle} /></MemoryRouter></LazyMotion>)
  return { choose, advance, onBattle }
}
describe('chapter map presentation', () => {
  it('shows both tradeoffs, actual roles and weaknesses, and five portrait overlays', async () => {
    mount()
    expect(await screen.findByRole('button', { name: 'Continue · Quiet camp' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enter battle · Elite challenge' })).toBeTruthy()
    expect(screen.getByText(/Debuff caster · Weak to lightning/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Review party' }))
    expect(screen.getByLabelText('Five-outfit party').querySelectorAll('[title]')).toHaveLength(5)
  })
  it('keeps every path command disabled while account acknowledgement is pending', async () => {
    const value = view()
    value.pending = [{ id: 'pending-map', status: 'pending', queuedAt: 1, conflict: null, dependsOn: null,
      body: { schemaVersion: 1, commandId: 'pending-map', action: 'choose-node', expected: [], upserts: [], appends: [] } }]
    const { choose, advance } = mount(value)
    const control = await screen.findByRole('button', { name: 'Enter battle · Elite challenge' }) as HTMLButtonElement
    expect(control.disabled).toBe(true)
    fireEvent.click(control)
    expect(choose).not.toHaveBeenCalled(); expect(advance).not.toHaveBeenCalled()
    expect(screen.getByText('Pending sync · map progress not yet accepted')).toBeTruthy()
  })
  it('shows content unavailable and never enables a substitute encounter', async () => {
    const value = view(); value.pack = null; value.chapter = null; value.unavailable = 'Frozen chapter content unavailable'
    mount(value)
    expect(await screen.findByRole('heading', { name: 'Chapter content unavailable' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Enter battle/ })).toBeNull()
  })
  it('contains guide focus and returns it after Escape', async () => {
    mount(); const button = await screen.findByRole('button', { name: 'Chapter guide' })
    button.focus(); fireEvent.click(button)
    const dialog = await screen.findByRole('dialog', { name: 'Checkpoints, retries and devices' })
    const close = screen.getByRole('button', { name: 'Close the guide' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button)
  })
})
