// Resilient device-only selection/map memory; never a release switch (docs/design/uma-puzzles.md §9).
import { PUZZLE_PARTY_IDS, SCENARIOS, puzzleChapter } from '@racer/domain'
export interface PuzzleNavigation { partyId: string; scenarioId: string; positions: Record<string, string> }
const empty = (): PuzzleNavigation => ({ partyId: PUZZLE_PARTY_IDS[0], scenarioId: SCENARIOS[0]!.id, positions: {} })
function browserStorage() { try { return globalThis.localStorage ?? null } catch { return null } }
export function createPuzzleNavigation(key: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage()) {
  let value = empty()
  try {
    const raw: unknown = JSON.parse(storage?.getItem(key) ?? 'null')
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      if (PUZZLE_PARTY_IDS.includes(r.partyId as never)) value.partyId = r.partyId as string
      if (SCENARIOS.some(s => s.id === r.scenarioId)) value.scenarioId = r.scenarioId as string
      if (r.positions && typeof r.positions === 'object') for (const p of PUZZLE_PARTY_IDS) for (const s of SCENARIOS) {
        const id = (r.positions as Record<string, unknown>)[`${p}/${s.id}`]
        if (puzzleChapter(s.id).nodes.some(n => n.id === id)) value.positions[`${p}/${s.id}`] = id as string
      }
    }
  } catch { /* Navigation never blocks gameplay when localStorage is unavailable. */ }
  const save = () => { try { storage?.setItem(key, JSON.stringify(value)) } catch { /* Keep the in-memory selection. */ } }
  return { read: () => structuredClone(value), choose: (partyId: string, scenarioId: string) => {
    if (!PUZZLE_PARTY_IDS.includes(partyId as never) || !SCENARIOS.some(s => s.id === scenarioId)) return
    value = { ...value, partyId, scenarioId }; save()
  }, position: (partyId: string, scenarioId: string, nodeId: string) => {
    if (!PUZZLE_PARTY_IDS.includes(partyId as never) || !SCENARIOS.some(s => s.id === scenarioId) || !puzzleChapter(scenarioId).nodes.some(n => n.id === nodeId)) return
    value.positions[`${partyId}/${scenarioId}`] = nodeId; save()
  } }
}
