// The stage journal on Dexie (T155, D384): a play's row is written, read back and cleared in `stageJournal`, never in
// the outbox; a row that doesn't read as a play is dropped, so its play starts again.
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { SaveDb } from './db'
import { dexieJournal, memoryJournal, readStoredJournal } from './journal'

const ROW = {
  id: 'training-yard:uma-1:1',
  careerId: 'uma-1:1',
  journal: {
    config: { kind: 'training-yard', seed: 7, T: 1, uma: { id: 'uma-1', growth: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } }, deck: [], bonds: {}, seasonFocus: 'speed', practice: false },
    version: 1,
    inputs: [{ tick: 0, code: 0, x: 1, y: 2 }, { tick: 1, code: 1 }],
  },
} as const

describe('the stage journal', () => {
  it('writes, reads back and clears a play in stageJournal alone', async () => {
    const db = new SaveDb('uma-racer-g3-journal-test')
    const journal = dexieJournal(db)
    await journal.write(ROW)
    expect(await journal.read(ROW.id)).toEqual(ROW)
    expect(await db.outbox.count()).toBe(0)
    await journal.clear(ROW.id)
    expect(await journal.read(ROW.id)).toBeNull()
    db.close()
  })

  it('drops a row that doesn\'t read as a play', async () => {
    const db = new SaveDb('uma-racer-g3-journal-bad')
    await db.stageJournal.put({ id: 'training-yard:practice', moves: [1, 2] })
    expect(await dexieJournal(db).read('training-yard:practice')).toBeNull()
    expect(await db.stageJournal.count()).toBe(0)
    db.close()
    expect(readStoredJournal({ ...ROW, journal: { ...ROW.journal, inputs: [{ tick: 'a' }] } })).toBeNull()
    expect(readStoredJournal({ ...ROW, journal: { ...ROW.journal, config: { ...ROW.journal.config, kind: 'puzzle' } } })).toBeNull()
  })

  it('keeps copies in memory, so a later change to the play doesn\'t reach the stored one', async () => {
    const journal = memoryJournal()
    const row = structuredClone(ROW) as unknown as { journal: { inputs: unknown[] } } & typeof ROW
    await journal.write(row)
    row.journal.inputs.push({ tick: 2, code: 0, x: 0, y: 0 })
    expect((await journal.read(ROW.id))?.journal.inputs).toHaveLength(2)
  })
})
