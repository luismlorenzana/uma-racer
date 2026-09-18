// Static content-pack contracts produced by scripts/data (docs/technical/architecture.md §3).

import type { CardEffect } from './cards'
import type { Aptitudes, DistanceCategory, RaceGrade, StatKey, Stats, Surface } from './types'

export interface UmaTemplate {
  id: string
  charaId: string
  name: string
  outfit: string | null
  jpRelease: string
  globalRelease: string | null
  starter: boolean
  baseStats: Stats
  growthRates: Stats
  aptitudes: Aptitudes
  uniqueSkillId: string | null
  awakeningSkillIds: string[]
  realHorseSex: 'male' | 'female' | null
  /** Ordered, distinct source race-family ids from this character's career objectives. */
  signatureRaceFamilyIds: string[]
  imageSource: string
}

export type SupportCardType = StatKey | 'friend' | 'group'
export type SupportCardObtain = 'gacha' | 'event' | 'free' | 'unknown'

export interface SupportCardUniqueEffect {
  level: number
  effects: { type: number; value: number }[]
}

export interface SupportCardTemplate {
  id: string
  charaId: string
  charName: string
  title: string
  type: SupportCardType
  jpRelease: string
  era: number
  obtain: SupportCardObtain
  starter: boolean
  hintSkillIds: string[]
  eventSkillIds: string[]
  effectProfile: Record<CardEffect, number>
  uniqueEffect: SupportCardUniqueEffect | null
  imageSource: string
}

export type SkillKind = 'white' | 'gold' | 'unique-upgraded' | 'inherited-unique' | 'unique'

export interface SkillCondition {
  precondition: string | null
  condition: string | null
  baseTime: number | null
  cooldown: number | null
  effects: { type: number; value: number }[]
}

export interface SkillTemplate {
  id: string
  kind: SkillKind
  name: string
  description: string
  costSp: number | null
  iconId: number | null
  /** 0/null = guaranteed when its condition is met; 1 = seeded Wit activation check. */
  activation?: number | null
  conditions: SkillCondition[]
  inheritedSkillId: string | null
  /** Normal white counterpart used when a directly learned gold skill becomes inheritable. */
  normalSkillId: string | null
}

export type RaceDirection = 'right' | 'left' | 'straight'

export interface RaceTemplate {
  id: string
  /** Stable source race-family id shared by calendar variants of the same race. */
  familyId: string
  name: string
  grade: RaceGrade
  surface: Surface
  distance: number
  distanceCategory: DistanceCategory
  direction: RaceDirection
  venue: string
  courseId: string
  season: number
  fieldSize: number
}

export interface CourseTemplate {
  id: string
  trackId: string
  /** Imported distance-category code, not the course length in meters. */
  distance: number
  terrain: number
  turn: number
  corners: CourseCorner[]
  straights: CourseStraight[]
  slopes: unknown
}

export interface CourseCorner {
  start: number
  end: number
  number: number
}

export interface CourseStraight {
  start: number
  end: number
  frontType: number
}

export interface ContentManifestFile {
  path: string
  bytes: number
  sha256: string
}

export interface ContentManifest {
  version: string
  generatedAt: string
  source: Record<string, string>
  files: ContentManifestFile[]
}

export interface ContentPack<T> {
  version: string
  items: T[]
}

export type ContentAtlasKind = 'uma-icons' | 'card-icons'

export interface ContentAtlasPage {
  path: string
  width: number
  height: number
}

export interface ContentAtlasFrame {
  page: number
  x: number
  y: number
  width: 128
  height: 128
}

export interface ContentAtlas {
  schemaVersion: 1
  kind: ContentAtlasKind
  frameWidth: 128
  frameHeight: 128
  pages: ContentAtlasPage[]
  frames: Record<string, ContentAtlasFrame>
}
