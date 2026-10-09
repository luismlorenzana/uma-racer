// @vitest-environment jsdom
// Invented bank and stacks only (D309).
import { createInspirationBank, openBankOutfit, repayInspiration } from '@racer/domain'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import type { RpgAccount } from '../../game/rpg-local'
import { RpgConvertScreen, RpgInventoryScreen } from './RpgItemsScreen'
import { RpgContext, type RpgContextValue } from './RpgScreen'

afterEach(cleanup)
const unit = (tier: number) => ({ tier, inspiration: { slots: [], golds: [] } })
const bank = repayInspiration(openBankOutfit(createInspirationBank([{ id: 'invented', scenarios: [unit(1), unit(2)] }], 1), 'invented'),
  'inspiration:t1:skill', 9).bank!
const account = (tokens: Record<string, number>): RpgAccount => ({ outfits: new Map(), presets: [], runs: [], tokens, bank })
function show(node: ReactNode, tokens: Record<string, number>, path = '/rpg/inventory') {
  const value: RpgContextValue = { content: { atlases: {} } as unknown as LoadedContent, account: account(tokens), release: null,
    retryRelease: () => {}, chapters: null, openGuide: () => {} }
  return render(<MemoryRouter initialEntries={[path]}><RpgContext.Provider value={value}>{node}</RpgContext.Provider></MemoryRouter>)
}

describe('RPG Inventory and Convert (D309)', () => {
  it('lists owned scenario tokens and what the advance has been repaid while it is owed', () => {
    show(<RpgInventoryScreen />, { 'inspiration:t1:skill': 0, 'inspiration:t3:slot': 2, 'inspiration:t3:skill': 5 })
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(expect.arrayContaining(['Parties', 'Roster', 'Inventory', 'Convert']))
    expect(screen.getByRole('heading', { name: 'Inspiration advance' })).toBeTruthy()
    expect(screen.getByText('9').parentElement!.textContent).toBe('9 of 24 repaid')
    // Rows with tokens or debt: URA Finale and Unity Cup owe the advance, Trackblazer holds tokens.
    expect(screen.getByRole('link', { name: /^URA Finale/ }).textContent).toMatch(/Advance owed: 6 Slot · 3 Skill/)
    expect(screen.getByRole('link', { name: /^Trackblazer: 2 Slot and 5 Skill tokens/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Grand Masters/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByRole('link', { name: /^Grand Masters/ })).toBeTruthy()
  })

  it('previews a conversion, its advance repayment and the batches Items can cover', () => {
    show(<RpgConvertScreen />, { 'inspiration:t2:skill': 5 }, '/rpg/convert?tier=1')
    fireEvent.click(screen.getByRole('button', { name: /^Down: 1 Unity Cup for 2 URA Finale/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Max' }))
    expect(screen.getByText('5', { selector: 'b' })).toBeTruthy()
    expect(screen.getByText(/3 of the 10 repay URA Finale's advance and can't be converted back; 7 land in Items/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Convert 5 → 10' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /^Up: 2 URA Finale/ }))
    expect(screen.getByRole('status').textContent).toMatch(/You need 2 URA Finale Skill tokens/)
    expect((screen.getByRole('button', { name: 'Convert 2 → 1' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
