// @vitest-environment jsdom
import { enrollRpgOutfit, learnRpgNode, type RpgProfile } from '@racer/domain'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProfileProgress } from './RpgScreen'

afterEach(cleanup)
// Invented outfit only.
const profile = (): RpgProfile => {
  const p = enrollRpgOutfit({ outfit: { id: 'invented', baseStats: { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'C' }, strategy: { front: 'A', pace: 'A', late: 'C', end: 'C' } } },
  contentVersion: 'test', classId: 'brawler', weapons: ['greatsword', 'spear'] })
  return ['greatsword.fire.1', 'greatsword.fire.2', 'greatsword.fire.2a'].reduce(learnRpgNode, { ...p, level: 10 })
}

describe('class tree screen (D270)', () => {
  it('shows both trees, a branch at a time, core skills with their forks and why a node is closed', () => {
    render(<ProfileProgress outfitId="invented" profile={profile()} />)
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Greatsword', 'Spear', 'Fire', 'Ice', 'Lightning'])
    expect(screen.getByRole('button', { name: 'Flame Slash, learned' })).toBeTruthy()
    // A learned variant can be swapped out; the other side of its fork is closed.
    expect(screen.getByRole('button', { name: 'Searing Crush (variant), learned' }).textContent).toMatch(/Swap out/)
    expect(screen.getByRole('button', { name: /Twin Embers \(variant\), The other side/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Inferno Edge, Opens at Lv20/ })).toBeTruthy()
    expect(screen.getByText('Greatsword variants 1/3')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Spear' }))
    const spear = screen.getByRole('button', { name: /Ember Thrust, can learn/ })
    expect(within(spear).getByText(/random foes · 2 hits · 1\.7× · 10 MP/)).toBeTruthy()
    expect(within(spear).getByText('Learn · 1 pt')).toBeTruthy()
  })

  it('offers a free class or weapon change only while nothing is learned', () => {
    const fresh = { ...profile(), tree: [] }
    render(<ProfileProgress outfitId="invented" profile={fresh} />)
    expect(screen.getByLabelText(/Class and weapons/)).toBeTruthy()
    cleanup()
    render(<ProfileProgress outfitId="invented" profile={profile()} />)
    expect(screen.queryByLabelText(/Class and weapons/)).toBeNull()
  })
})
