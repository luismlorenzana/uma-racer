import { constellationTemplate } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { constellationNodeHref } from './constellation-links'

describe('constellation node links', () => {
  it('opens each node on the matching page after a Training Level unlock', () => {
    const nodes = constellationTemplate(1).nodes
    const card = nodes.find((node) => node.kind === 'card')!
    const parent = nodes.find((node) => node.kind === 'parent')!
    expect(constellationNodeHref('synthetic uma', 1, card.id)).toBe(`/constellation/synthetic%20uma?node=${card.id}`)
    expect(constellationNodeHref('synthetic uma', 1, parent.id)).toBe(`/constellation/synthetic%20uma/inspiration?node=${parent.id}`)
  })
})
