import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isDevFarmKitchenProofPath } from '../../app/farm-proof-routes'

const source = readFileSync('src/screens/farm/FarmKitchenScreen.tsx', 'utf8')
const proof = readFileSync('src/screens/farm/FarmKitchenProofScreen.tsx', 'utf8')
const guide = readFileSync('src/screens/farm/FarmKitchenGuide.tsx', 'utf8')
describe('Farm kitchen phone screens', () => {
  it('has six fixed station tiles, 44pt actions and no old locks, aggregate level or native selects', () => {
    expect(source).toContain('grid-rows-3')
    expect(source).toContain('grid-cols-2')
    expect(source).toContain('min-h-11')
    expect(source).not.toContain('<select')
    expect(source).not.toContain('aggregate Farm Level')
    expect(source).not.toContain('Locked station')
  })
  it('routes every gameplay mutation through the real host and has no required cooking gesture', () => {
    for (const call of ['host.assign', 'host.remove', 'host.start', 'host.claim', 'host.collectAll', 'host.spendEnergy', 'host.grantEnergy']) expect(source).toContain(call)
    expect(source).not.toMatch(/onPointerMove|onTouchMove|cooking score|burn/i)
  })
  it('keeps the proof isolated from account/runtime providers and uses a unique real Dexie host', () => {
    expect(proof).toContain('PersistentFarmKitchenHost')
    expect(proof).toContain('crypto.randomUUID()')
    expect(proof).not.toMatch(/useGame|useContent|gameRuntime|AuthProvider|saveApi/)
    expect(isDevFarmKitchenProofPath('/dev/farm-kitchen-proof/district/garden')).toBe(true)
    expect(isDevFarmKitchenProofPath('/farm')).toBe(false)
  })
  it('imports numeric guide copy from rules and remembers one versioned guide', () => {
    expect(guide).toMatch(/FARM_KITCHEN_EXP_PER_JOB.*FARM_KITCHEN_JOB_MS.*FARM_KITCHEN_STATIONS_PER_DISTRICT/)
    expect(guide).toContain('farm-kitchen-guide-v1')
    expect(guide).toContain('createGuideMemory')
  })
})
