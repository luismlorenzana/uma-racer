// The uma-art check (docs/game/08-item-catalogue-and-recipes.md §10, §13; M033 "Art ids"): every id and name the
// catalogue holds against the installed @luismlorenzana/uma-art 2.4.0 indexes. Only this test reads the art package;
// the catalogue is frozen data and never imports it.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { DUOS, ITEMS, SPEED_TICKET_ID } from './catalogue'
import { FAMILY_IDS } from './families'

interface ItemFrame {
  readonly name: string
  readonly family: string
  readonly side: 'farming' | 'gathering'
  readonly grade: number
  readonly refined: boolean
}
interface DishFrame {
  readonly name: string
  readonly kind: 'planet' | 'duo' | 'feast'
  readonly grade: number
  readonly family?: string
}

const require = createRequire(import.meta.url)
const ART = '@luismlorenzana/uma-art'
const reads = (path: string): unknown => JSON.parse(readFileSync(require.resolve(`${ART}/${path}`), 'utf8'))

/** An atlas index's frames, each wrapped so reading uma-rpg's `effect` field fails: this game ignores it (08 §2). */
function frames<F extends object>(path: string): Readonly<Record<string, F>> {
  const index = reads(path) as { frames: Record<string, F> }
  return Object.fromEntries(Object.entries(index.frames).map(([id, frame]) => [id, new Proxy(frame, {
    get(target, key, receiver) {
      if (key === 'effect') throw new Error(`${path} ${id}: the effect field was read`)
      return Reflect.get(target, key, receiver) as unknown
    },
  })]))
}

const ITEM_FRAMES = frames<ItemFrame>('items/atlas.json')
const DISH_FRAMES = frames<DishFrame>('dishes/atlas.json')

describe('uma-art 2.4.0', () => {
  it('is the exact-pinned dev dependency', () => {
    expect((reads('package.json') as { version: string }).version).toBe('2.4.0')
    const domain = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      dependencies?: Record<string, string>; devDependencies?: Record<string, string>
    }
    expect(domain.devDependencies?.[ART]).toBe('2.4.0')
    expect(domain.dependencies?.[ART]).toBeUndefined()
  })

  it('draws every raw and crafted item as a farming-side items frame with the same family, grade, flag and name', () => {
    for (const item of ITEMS) {
      if (item.kind !== 'raw' && item.kind !== 'crafted') continue
      expect(item.art, item.id).toEqual({ atlas: 'items', frame: item.id })
      const frame = ITEM_FRAMES[item.id]
      expect(frame, item.id).toBeDefined()
      expect({ side: frame!.side, family: frame!.family, grade: frame!.grade, refined: frame!.refined, name: frame!.name }, item.id)
        .toEqual({ side: 'farming', family: item.family, grade: item.grade, refined: item.refined, name: item.name })
    }
  })

  it('draws every planet dish and Feast as its own dishes frame with the same kind, grade, family and name', () => {
    for (const item of ITEMS) {
      if (item.kind !== 'dish' || item.dish === 'duo') continue
      expect(item.art, item.id).toEqual({ atlas: 'dishes', frame: item.id })
      const frame = DISH_FRAMES[item.id]
      expect(frame, item.id).toBeDefined()
      expect({ kind: frame!.kind, grade: frame!.grade, name: frame!.name }, item.id).toEqual({ kind: item.dish, grade: item.grade, name: item.name })
      if (item.dish === 'planet') expect(frame!.family, item.id).toBe(item.family)
    }
  })

  it('draws each Duo with a duo frame of grade 3 (grade 3) or 7 (grade 5), named as the Duo', () => {
    for (const duo of DUOS) {
      expect(duo.art.atlas).toBe('dishes')
      expect(duo.art.frame).not.toBe(duo.id)
      const frame = DISH_FRAMES[duo.art.frame]
      expect(frame, duo.id).toBeDefined()
      expect({ kind: frame!.kind, grade: frame!.grade, name: frame!.name }, duo.id)
        .toEqual({ kind: 'duo', grade: duo.grade === 3 ? 3 : 7, name: duo.name })
    }
  })

  it('uses 160 of 320 item frames and 92 of 100 dish frames; the unused dishes are the four non-stat bridges', () => {
    const used = (atlas: 'items' | 'dishes') => new Set(ITEMS.flatMap((item) => (item.art?.atlas === atlas ? [item.art.frame] : [])))
    expect(Object.keys(ITEM_FRAMES)).toHaveLength(320)
    expect(Object.keys(DISH_FRAMES)).toHaveLength(100)
    expect(used('items').size).toBe(160)
    expect(used('dishes').size).toBe(92)
    expect(Object.keys(DISH_FRAMES).filter((id) => !used('dishes').has(id)).sort()).toEqual([
      'duo-def-mdef-3', 'duo-def-mdef-7', 'duo-hp-def-3', 'duo-hp-def-7', 'duo-limit-hp-3', 'duo-limit-hp-7', 'duo-mdef-mp-3', 'duo-mdef-mp-7',
    ])
  })

  it('takes the whole farming side and nothing from the gathering side', () => {
    const farming = Object.entries(ITEM_FRAMES).filter(([, frame]) => frame.side === 'farming')
    const gathering = new Set(Object.entries(ITEM_FRAMES).filter(([, frame]) => frame.side === 'gathering').map(([id]) => id))
    expect(new Set(farming.map(([, frame]) => frame.family))).toEqual(new Set(FAMILY_IDS))
    expect(new Set(farming.map(([id]) => id))).toEqual(new Set(ITEMS.flatMap((item) => (item.art?.atlas === 'items' ? [item.id] : []))))
    expect(gathering.size).toBe(160)
    for (const item of ITEMS) expect(gathering.has(item.id), item.id).toBe(false)
  })

  it('leaves only the Speed Ticket without a frame, and never reads the effect field', () => {
    expect(ITEMS.filter((item) => item.art === null).map((item) => item.id)).toEqual([SPEED_TICKET_ID])
    expect(DISH_FRAMES[SPEED_TICKET_ID]).toBeUndefined()
    expect(ITEM_FRAMES[SPEED_TICKET_ID]).toBeUndefined()
    // The guard above is live: a read of `effect` would have thrown in the checks before.
    expect(() => (ITEM_FRAMES.honey as unknown as { effect: string }).effect).toThrow(/effect field was read/)
  })
})
