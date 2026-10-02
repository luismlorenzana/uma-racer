import { describe, expect, it } from 'vitest'
import { parseItemLedgerEntry } from './farm/types'
import { depositTrainingExp } from './training'
import { maxLevelUpTickets, resolveTrainingLevelUp } from './training-level-up'

const spend = (trainingLevel: number, trainingExp: number, count: number, owned = 9) =>
  resolveTrainingLevelUp({ umaId: 'u1', tier: 2, trainingLevel, trainingExp, count, owned, now: 40 })

describe('Training Level-Up Tickets (D213)', () => {
  it('raises exactly one level a ticket and keeps the progress inside the level', () => {
    expect(spend(1, 0, 3)).toMatchObject({ trainingLevel: 4, trainingExp: 0, levelsGained: 3, overflowExp: 0 })
    expect(spend(3, 700, 2)).toMatchObject({ trainingLevel: 5, trainingExp: 700, overflowExp: 0 })
    const command = spend(6, 120, 1)
    expect(command.movement).toEqual({
      id: 'level-up:u1:2:6.120', itemId: 'training:level-up-ticket', delta: -1, reason: 'training-level-up',
      source: { kind: 'level-up', umaId: 'u1', tier: 2, fromLevel: 6, fromExp: 120 }, createdAt: 40,
    })
    expect(parseItemLedgerEntry(command.movement)).toEqual(command.movement)
    expect(command.bankEvidenceId).toBe('exp-bank:level-up:u1:2:6.120')
  })

  it('sends what passes TL10 to the bank, which may pay a ticket straight back', () => {
    // TL8 · 900 and two tickets: TL10 with 900 banked.
    expect(spend(8, 900, 2)).toMatchObject({ trainingLevel: 10, trainingExp: 0, overflowExp: 900 })
    // TL9 · 800 and one ticket with 600 already banked: 1,400 in the bank is one ticket back and 150 left.
    const last = spend(9, 800, 1)
    expect(last.overflowExp).toBe(800)
    expect(depositTrainingExp(600, last.overflowExp)).toEqual({ bank: 150, tickets: 1 })
  })

  it('offers from one ticket to the lesser of those owned and the levels left', () => {
    expect([[1, 3], [1, 20], [8, 9], [10, 4], [5, 0]].map(([level, owned]) => maxLevelUpTickets(level!, owned!))).toEqual([3, 9, 2, 0, 0])
    expect(() => spend(10, 0, 1)).toThrow(/TL10/)
    expect(() => spend(8, 0, 3)).toThrow(/At most 2/)
    expect(() => spend(1, 0, 4, 3)).toThrow(/Not enough/)
    expect(() => spend(1, 0, 0)).toThrow(/at least one/)
  })
})
