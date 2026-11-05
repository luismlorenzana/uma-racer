// The device's operation env (T136, T152): the domain's `buildOperationEnv` from the content packs, cached per content
// version, whose version is the release manifest's and the racer overlay's as the API joins them, with `dev` only in dev
// builds (M034).
import { describe, expect, it } from 'vitest'
import { syntheticContent, SYNTH_MANIFEST, SYNTH_OVERLAY, umaId } from '../__fixtures__/content'
import { contentVersionOf, operationEnv } from './env'

const content = (manifest: string, overlay = SYNTH_OVERLAY) => ({ ...syntheticContent(), manifest: { version: manifest }, overlay: { version: overlay } })

describe('operationEnv', () => {
  it("builds the operations' maps from the packs, once per content version", () => {
    const first = operationEnv(content('v1'), false)
    expect(first.content.umas.get(umaId(1))?.name).toBe('Amber Sprint')
    expect(first.content.cards.size).toBe(7)
    expect(first.dev).toBeUndefined()
    expect(operationEnv(content('v1'), false)).toBe(first)
    expect(operationEnv(content('v2'), false)).not.toBe(first)
    expect(operationEnv(content('v2', '000000000000'), false)).not.toBe(operationEnv(content('v2'), false))
  })

  it("names its content version as the API does: the manifest's, then the overlay's", () => {
    expect(contentVersionOf(syntheticContent())).toBe(`${SYNTH_MANIFEST}:${SYNTH_OVERLAY}`)
    expect(operationEnv(content('v4'), false).contentVersion).toBe(`v4:${SYNTH_OVERLAY}`)
  })

  it('runs dev operations only in dev builds', () => {
    expect(operationEnv(content('v3'), true).dev).toBe(true)
    expect(operationEnv(content('v3'), false).dev).toBeUndefined()
  })
})
