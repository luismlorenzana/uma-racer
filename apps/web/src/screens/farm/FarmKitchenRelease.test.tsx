// @vitest-environment jsdom
// Release entry regressions use actual read-only host/Dexie; invented rows only.
import 'fake-indexeddb/auto'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { farmCutoverFixture } from '../../../../../packages/domain/src/farm/kitchen/cutover-fixtures'
import { RacerDb } from '../../game/db'
import { PersistentFarmKitchenHost } from '../../game/farm/kitchen/host'
import { FarmKitchenCommonShell, type FarmKitchenEnvironment } from './FarmKitchenScreen'

let sequence = 0
const databases: RacerDb[] = []
async function entry(corrupt = false) {
  const database = new RacerDb(`farm-release-dom-${++sequence}`); databases.push(database); await database.open()
  const f = farmCutoverFixture(6, 14, 'v2')
  for (const row of f.entities.values()) await database.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: false })
  // Deliberately bypass the typed table to model an untrusted future row read from storage.
  if (corrupt) await database.table('farm').put({ id: 'main', data: { schemaVersion: 99 }, version: 2, deleted: false, updatedAt: 2 })
  const host = new PersistentFarmKitchenHost({ database, enabled: true })
  const prepare = vi.spyOn(host, 'prepareUpgrade').mockResolvedValue(false)
  const environment: FarmKitchenEnvironment = { database, host, workers: Array.from({ length: 6 }, (_, index) => ({ id: `invented-${String(index).padStart(4, '0')}`, name: `Invented ${index}`, outfit: null })), content: null, isolated: true, root: '/dev/farm-kitchen-proof/release', ownerDebugAllowed: false }
  render(<MemoryRouter><FarmKitchenCommonShell environment={environment} /></MemoryRouter>)
  return { database, prepare }
}
afterEach(async () => { cleanup(); for (const database of databases.splice(0)) await database.delete() })
describe('Farm release boundary', () => {
  it('owned legacy outfits render preparation, not new crew or fake empty progress; opening never resets', async () => {
    const { database, prepare } = await entry()
    await screen.findByRole('heading', { name: 'Prepare Stable Kitchen' })
    expect(prepare).not.toHaveBeenCalled(); expect(await database.farmRecovery.count()).toBe(0)
    expect(screen.queryByText('Five districts · 30 open stations')).toBeNull()
    expect(screen.getByRole('button', { name: 'Export private recovery' })).toBeDefined()
    expect((await database.farm.get('main'))!.data.schemaVersion).toBe(2)
  })
  it('only an explicit preparation press calls the host and leaves a failed upgrade retryable', async () => {
    const { prepare } = await entry()
    fireEvent.click(await screen.findByRole('button', { name: 'Archive and prepare Farm' }))
    await screen.findByText(/Original intents remain saved/)
    expect(prepare).toHaveBeenCalledTimes(1)
  })
  it('unknown generation exposes recovery instead of hanging on Opening or rendering v2', async () => {
    const { prepare } = await entry(true)
    await screen.findByRole('heading', { name: 'Farm needs recovery' })
    expect(screen.queryByRole('button', { name: 'Archive and prepare Farm' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry reading Farm' })).toBeDefined()
    expect(prepare).not.toHaveBeenCalled()
  })
})
