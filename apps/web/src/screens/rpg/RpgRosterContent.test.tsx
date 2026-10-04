// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpgOutfitPicker, RpgRosterContent } from './RpgScreen'
import { releaseProofFixture, releaseProofNames } from './release-proof-fixture'
afterEach(cleanup)

describe('compact roster and filtered party picker', () => {
  it('shows enrolled first in a five-column icon grid with accessible identities and no weapon/element text', () => {
    const { view } = releaseProofFixture()
    const names = { ...releaseProofNames, 'not-enrolled': 'Aster' }
    render(<MemoryRouter><RpgRosterContent view={view} content={null} names={names} ownedIds={Object.keys(names)} /></MemoryRouter>)
    const groups = screen.getAllByRole('region')
    expect(groups.map(group => group.getAttribute('aria-label'))).toEqual(['Enrolled', 'Not enrolled'])
    expect(screen.getByLabelText('Enrolled outfits').className).toContain('grid-cols-5')
    expect(screen.getByLabelText('Enrolled outfits').children).toHaveLength(5)
    const links = screen.getAllByRole('link')
    expect(links.at(-1)?.getAttribute('href')).toBe('/rpg/roster/not-enrolled')
    expect(screen.getByRole('link', { name: /Ember · Tier 1 · RPG Lv/ })).toBeTruthy()
    expect(screen.queryByText('Greatsword')).toBeNull()
    expect(screen.queryByText('Fire')).toBeNull()
    expect(within(groups[0]!).getAllByRole('img')).toHaveLength(5)
    expect(within(groups[1]!).queryByRole('img')).toBeNull() // No made-up weapon/element on unenrolled outfits.
  })

  it('uses the same all-party filter for the actual dropdown and updates when assignments change', () => {
    const { view } = releaseProofFixture()
    const draft = structuredClone(view.presets[1]!.data)
    const onChange = vi.fn()
    const props = { view, draft, index: 0, content: null, ownedIds: Object.keys(releaseProofNames), names: releaseProofNames, onChange }
    const { rerender } = render(<RpgOutfitPicker {...props} />)
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Empty slot'])
    const updated = { ...view, presets: view.presets.map(row => row.id === 'party-1'
      ? { ...row, data: { ...row.data, slots: [null, null, null, null, null] as typeof draft.slots } } : row) }
    rerender(<RpgOutfitPicker {...props} view={updated} />)
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Empty slot', 'Beacon', 'Dawn', 'Ember', 'Rill', 'Volt'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Outfit for slot 1' }), { target: { value: 'test-outfit-0' } })
    expect(onChange).toHaveBeenCalledWith('test-outfit-0')
  })
})
