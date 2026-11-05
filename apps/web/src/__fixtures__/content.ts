// Synthetic content for the web's tests (T152): a few invented Umas and support cards in today's `LoadedContent` shape,
// with no art, and the operation env built from them. Invented names and values only: nothing here is original-game
// content.
import type { ContentAtlas, SupportCardTemplate, UmaTemplate } from '@racer/domain'
import type { OperationEnv } from '@racer/domain/save'
import type { LoadedContent } from '../content/view'
import { operationEnv } from '../save/env'

export const SYNTH_MANIFEST = 'invented0001'
export const SYNTH_OVERLAY = 'abcdef012345'

const UMA_NAMES = ['Amber Sprint', 'Bluebell Dash', 'Cinder Gale', 'Dawn Meadow', 'Ember Flight', 'Fern Arrow', 'Gale Ribbon']

/** The n-th invented Uma's id, from 1. */
export const umaId = (n: number): string => `invented-uma-${String(n).padStart(2, '0')}`
/** The n-th invented card's id, from 1. */
export const cardId = (n: number): string => `invented-card-${String(n).padStart(2, '0')}`

const uma = (n: number): UmaTemplate => ({
  id: umaId(n), charaId: `invented-chara-${n}`, name: UMA_NAMES[n - 1]!, outfit: null, jpRelease: `202${n % 10}-01-01`, globalRelease: null,
  starter: false, baseStats: { speed: 80, stamina: 80, power: 80, guts: 80, wit: 80 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: {}, distance: {}, strategy: {} }, uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null,
  signatureRaceFamilyIds: [],
}) as unknown as UmaTemplate

const card = (n: number): SupportCardTemplate => ({
  id: cardId(n), charaId: `invented-chara-${n}`, charName: UMA_NAMES[n - 1]!, title: `Invented Title ${n}`, type: 'speed',
  jpRelease: '2021-01-01', era: 1, obtain: 'gacha', starter: false, hintSkillIds: [], hintOthers: [], eventSkillIds: [],
  effects: { 1: 10 }, uniqueEffect: null,
}) as unknown as SupportCardTemplate

const registry = <T extends { readonly id: string }>(items: readonly T[]) => ({ items, byId: new Map(items.map((item) => [item.id, item])) })
const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({ schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} })

/** The invented content: seven Umas, seven cards, no races, courses or skills, and no art. A new object each call. */
export function syntheticContent(): LoadedContent {
  return {
    manifest: { version: SYNTH_MANIFEST },
    overlay: { version: SYNTH_OVERLAY },
    origin: 'network',
    umas: registry(UMA_NAMES.map((_, i) => uma(i + 1))),
    cards: registry(UMA_NAMES.map((_, i) => card(i + 1))),
    skills: registry([]),
    races: registry([]),
    courses: registry([]),
    atlases: { 'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] } },
    art: { has: () => false, load: async () => null },
  }
}

/** The env the invented content gives: `dev` on, so `dev-grant` runs (dev builds). */
export const syntheticEnv = (dev = true): OperationEnv => operationEnv(syntheticContent(), dev)
