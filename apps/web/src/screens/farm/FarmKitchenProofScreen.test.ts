import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { FARM_KITCHEN_JOB_MS } from '@racer/domain/farm/kitchen'
import { createFarmKitchenProofEnvironment } from './FarmKitchenProofScreen'

const names: string[] = []
afterEach(async () => {
  for (const name of names.splice(0)) {
    const environment = await createFarmKitchenProofEnvironment(name)
    environment.database.close(); await environment.database.delete()
  }
})
const settle = () => new Promise(resolve => setTimeout(resolve, 15))
describe('isolated Farm kitchen UI proof', () => {
  it('uses the real host for a persisted assign, raw job, reload and claim', async () => {
    const name = `farm-kitchen-proof-${crypto.randomUUID()}`; names.push(name)
    const environment = await createFarmKitchenProofEnvironment(name)
    let view = await environment.host.read()
    expect(view).toMatchObject({ mode: 'active', stations: { length: 30 } })
    expect(environment.workers).toHaveLength(12)
    expect(view.stations.find(station => station.id === 'garden-1')?.status).toBe('ready')
    expect(view.stations.find(station => station.id === 'orchard-1')?.status).toBe('busy')

    let intentId = await environment.host.createIntent()
    await environment.host.assign({ intentId, expectedRevision: view.revision, stationId: 'garden-2', outfitId: 'invented-5' })
    await settle(); view = await environment.host.read()
    intentId = await environment.host.createIntent()
    await environment.host.start({ intentId, expectedRevision: view.revision, stationId: 'garden-2', outfitId: 'invented-5', recipeId: 'farm:raw:ura-finale:vegetable:speed', quantity: 1, choices: {} })
    await settle(); view = await environment.host.read()
    const job = view.stations.find(station => station.id === 'garden-2')!.job!
    expect(job.recipeId).toBe('farm:raw:ura-finale:vegetable:speed')

    const reloaded = await createFarmKitchenProofEnvironment(name)
    expect((await reloaded.host.read()).stations.find(station => station.id === 'garden-2')!.job).toEqual(job)
    reloaded.advanceProofClock?.(FARM_KITCHEN_JOB_MS)
    view = await reloaded.host.read(); expect(view.stations.find(station => station.id === 'garden-2')!.status).toBe('ready')
    intentId = await reloaded.host.createIntent()
    const claim = await reloaded.host.claim({ intentId, expectedRevision: view.revision, stationId: 'garden-2', outfitId: 'invented-5', jobId: job.id, recipeId: job.recipeId })
    expect(claim.prediction?.result).toMatchObject({ kind: 'claim', output: { amount: 6 } })
    await settle(); view = await reloaded.host.read()
    expect(view.items[job.recipeId]?.canonical).toBeGreaterThanOrEqual(6)
    environment.database.close(); reloaded.database.close()
  })
})
