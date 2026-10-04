// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { createInspirationBank, openBankOutfit } from '@racer/domain'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { InspirationBankPanel } from './InspirationBankPanel'
import { RpgInspirationReward } from './rpg/RpgInspirationReward'
afterEach(cleanup)
describe('read-only Inspiration debt and net rewards', () => {
  it('distinguishes debt from spendable inventory and documents shared preset scope', () => {
    const bank = openBankOutfit(createInspirationBank([{ id: 'invented-outfit', scenarios: [{ tier: 1, inspiration: { slots: [], golds: [] } }] }], 1), 'invented-outfit')
    render(<InspirationBankPanel preview={bank} tier={1} />)
    expect(screen.getByText('Inspiration advance · 18 to repay')).toBeTruthy()
    expect(screen.getByText('-6')).toBeTruthy(); expect(screen.getByText('-12')).toBeTruthy()
    expect(screen.getByText(/Existing inventory stays spendable/)).toBeTruthy()
    expect(screen.getByText(/all four distance presets/)).toBeTruthy()
  })
  it('shows gross, zero-net repayment and overflow deposits separately', () => {
    render(<RpgInspirationReward reward={{ tier: 1, slot: 30, skill: 60 }} repaid={{ slot: 30, skill: 36 }} label="Accepted rewards" />)
    expect(screen.getByText('30 repaid · 0 deposited in Items')).toBeTruthy()
    expect(screen.getByText('36 repaid · 24 deposited in Items')).toBeTruthy()
    expect(screen.getByText(/\+60 Inspiration Skill Token/)).toBeTruthy()
  })
})
