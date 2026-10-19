// The private content a race reads beyond the rules' (docs/design/racing.md "Pack racing"): courses, skills and every
// Uma of the field, in today's `LoadedContent` shape so today's pure race and badge views read it as they are. The app
// feeds the private content (T143); the seeds' mount has none, so it reads the seed's synthetic content, with an invented
// course for any race whose course it lacks and no art. Nothing here is original-game content.
import type { CourseTemplate, RaceTemplate } from '@racer/domain'
import type { OperationEnv } from '@racer/domain/check-in'
import { useMemo } from 'react'
import type { ContentAtlas } from '@racer/domain'
import type { LoadedContent } from '../../content/view'
import { useG2Content } from '../../app/content'
import { useGame } from '../../app/game'

/** The seeds' content version: what a synthetic race's seed and record name. */
export const DEV_CONTENT_VERSION = 'dev-synthetic'

/**
 * An invented course: straights and corners laid so 1,200, 1,600, 2,000 and 2,500 m each finish on a 200 m straight,
 * clipped to the race by `compileRaceCourseLayout`. Synthetic, as the farm proof's courses are.
 */
export function inventedCourse(id: string): CourseTemplate {
  const straights: [number, number][] = [[0, 300], [650, 850], [1000, 1200], [1400, 1600], [1800, 2000], [2250, 2500], [2750, 3200]]
  const corners: [number, number][] = [[300, 650], [850, 1000], [1200, 1400], [1600, 1800], [2000, 2250], [2500, 2750]]
  return {
    id, trackId: 'invented-track', distance: 3, terrain: 1, turn: 1, slopes: [],
    straights: straights.map(([start, end], i) => ({ start, end, frontType: i === 0 ? 2 : 1 })),
    corners: corners.map(([start, end], i) => ({ start, end, number: (i % 4) + 1 })),
  }
}

const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({ schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} })

/** The seed's content as today's `LoadedContent`: the rules' Umas, races, cards and skills, invented courses, no art. */
export function devRaceContent(env: OperationEnv): LoadedContent {
  const { content } = env
  const umas = [...content.umas.values()]
  const cards = [...content.cards.values()]
  const skills = [...content.skills.values()]
  const races: RaceTemplate[] = [...content.races]
  const courses = [...new Set(races.map((race) => race.courseId))].map(inventedCourse)
  const registry = <T extends { id: string }>(items: readonly T[]) => ({ items, byId: new Map(items.map((item) => [item.id, item])) })
  return {
    origin: 'network',
    manifest: { version: DEV_CONTENT_VERSION },
    umas: registry(umas),
    cards: registry(cards),
    skills: registry(skills),
    races: registry(races),
    courses: registry(courses),
    atlases: { 'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] } },
    art: { has: () => false, load: async () => null },
  }
}

const made = new WeakMap<OperationEnv, LoadedContent>()

/** The content races read: today's when mounted, else the seed's (memoised per env), or null until the game opens. */
export function useRaceContent(): LoadedContent | null {
  const loaded = useG2Content()
  const env = useGame((snapshot) => snapshot.env)
  return useMemo(() => {
    if (loaded !== null) return loaded
    if (env === null) return null
    let content = made.get(env)
    if (content === undefined) {
      content = devRaceContent(env)
      made.set(env, content)
    }
    return content
  }, [loaded, env])
}
