// Read-only account/party/map projections (docs/design/uma-puzzles.md §§3–4,6,9).
import { createPuzzleCheckpoint, createPuzzleSource, eligiblePuzzleElements, eligiblePuzzleStyles, parsePuzzleCampaignId,
  puzzleChapter, puzzleChapterStatus, puzzleEncounterRewards, puzzleMaterialId, PUZZLE_LEADERS, puzzleStats,
  type PuzzleCheckpointSaveV1, type PuzzleElement, type PuzzleMapNode, type PuzzleOutfitSaveV1,
  type PuzzlePresetSaveV1, type UmaTemplate } from '@racer/domain'
import type { PuzzleAccount } from './host'
export interface PuzzleRosterEntry {
  id: string; name: string; template: UmaTemplate | null; outfit: PuzzleOutfitSaveV1 | null
  source: ReturnType<typeof createPuzzleSource> | null; elements: PuzzleElement[]; unavailable: string | null
}

export function puzzleRoster(owned: readonly string[], templates: ReadonlyMap<string, UmaTemplate>, account: PuzzleAccount,
  contentVersion: string, element: PuzzleElement | 'all' = 'all', style: string = 'all') {
  return owned.flatMap<PuzzleRosterEntry>(id => {
    const outfit = account.outfits.find(o => o.outfitId === id) ?? null
    const template = templates.get(id)
    if (!template) return [{ id, name: id, template: null, outfit, source: outfit?.enrollment.source ?? null,
      elements: [], unavailable: 'Original Uma content is unavailable. Saved enrollment is unchanged.' }]
    try {
      const source = outfit?.enrollment.source ?? createPuzzleSource(template, contentVersion)
      const elements = eligiblePuzzleElements(source), styles = eligiblePuzzleStyles(source)
      if (element !== 'all' && (outfit ? outfit.enrollment.element !== element : !elements.includes(element))) return []
      if (style !== 'all' && !styles.includes(style as never)) return []
      return [{ id, name: template.name, template, outfit, source, elements,
        unavailable: styles.length ? null : 'No original A running style. She stays available in every other mode.' }]
    } catch { return [{ id, name: template.name, template, outfit, source: null, elements: [], unavailable: 'Original source needs verification.' }] }
  }).sort(puzzleRosterOrder)
}
export function puzzleRosterOrder(a: PuzzleRosterEntry, b: PuzzleRosterEntry): number {
  return Number(Boolean(b.outfit)) - Number(Boolean(a.outfit)) ||
    (!a.outfit && !b.outfit ? Number(Boolean(a.unavailable)) - Number(Boolean(b.unavailable)) : 0) ||
    (b.outfit?.enrollment.level ?? 0) - (a.outfit?.enrollment.level ?? 0) ||
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}
export function puzzleColourCounts(account: PuzzleAccount) {
  const counts: Record<PuzzleElement, number> = { fire: 0, water: 0, wood: 0, light: 0, dark: 0 }
  for (const outfit of account.outfits) counts[outfit.enrollment.element]++
  return counts
}
export function suggestedPuzzleElement(eligible: readonly PuzzleElement[], account: PuzzleAccount) {
  const counts = puzzleColourCounts(account)
  return [...eligible].sort((a, b) => counts[a] - counts[b])[0] ?? null
}
export function openPuzzleParty(account: PuzzleAccount, partyId: string) {
  return account.checkpoints.find(c => c.progress.partyId === partyId && c.open) ?? null
}
export function foregroundPuzzleScenario(party: PuzzlePresetSaveV1) {
  const id = parsePuzzleCampaignId(party.foregroundChapter)
  return id?.kind === 'chapter' ? id.scenarioId : null
}
export function puzzlePartyMembers(party: PuzzlePresetSaveV1, account: PuzzleAccount) {
  return party.slots.flatMap(slot => {
    const outfit = slot && account.outfits.find(o => o.outfitId === slot.outfitId)
    if (!slot || !outfit) return []
    const e = outfit.enrollment
    return [{ outfitId: outfit.outfitId, source: e.source, level: e.level, element: e.element, kit: slot.kit, stats: puzzleStats(e.source, e.level) }]
  })
}
export function puzzlePartySummary(party: PuzzlePresetSaveV1, account: PuzzleAccount) {
  const members = puzzlePartyMembers(party, account), levels = members.map(m => m.level)
  const leader = PUZZLE_LEADERS.find(l => l.id === party.leaderId)!
  const total = (stat: keyof typeof members[number]['stats']) => members.reduce((n, m) => n + m.stats[stat], 0)
  return { members, full: members.length === party.slots.length && party.slots.every(Boolean),
    average: levels.length ? levels.reduce((a, b) => a + b / levels.length, 0) : null,
    min: levels.length ? Math.min(...levels) : null, max: levels.length ? Math.max(...levels) : null,
    // Same leader projection as puzzlePartyStats, without manufacturing a battle input for a partial party.
    totals: { maxHp: Math.round(total('hp') * (leader.stat === 'hp' ? leader.multiplier : 1)),
      rcv: Math.round(total('rcv') * (leader.stat === 'rcv' ? leader.multiplier : 1)), guard: total('guard'), resilience: total('resilience') },
    coverage: [...new Set(members.map(m => m.element))], leader: party.slots[0]?.outfitId ?? null }
}
export function puzzlePartyCandidates(account: PuzzleAccount, name: (id: string) => string, owned: readonly string[] = account.outfits.map(o => o.outfitId)) {
  const available = new Set(owned)
  const assigned = new Set(account.parties.flatMap(p => p.slots.flatMap(s => s ? [s.outfitId] : [])))
  return account.outfits.filter(o => available.has(o.outfitId) && !assigned.has(o.outfitId)).sort((a, b) =>
    b.enrollment.level - a.enrollment.level || name(a.outfitId).localeCompare(name(b.outfitId)) || a.outfitId.localeCompare(b.outfitId))
}
export function puzzleCheckpoint(account: PuzzleAccount, partyId: string, scenarioId: string) {
  return account.checkpoints.find(c => c.progress.partyId === partyId && c.scenarioId === scenarioId) ?? null
}
export function puzzleMapStatus(account: PuzzleAccount, partyId: string, scenarioId: string) {
  const chapter = puzzleChapter(scenarioId), checkpoint = puzzleCheckpoint(account, partyId, scenarioId)
  return { chapter, checkpoint, ...puzzleChapterStatus(chapter, checkpoint?.progress ?? createPuzzleCheckpoint(chapter, partyId)) }
}
export function puzzleNodeName(node: PuzzleMapNode) {
  if (node.kind === 'champion') return `${node.elements[0]![0]!.toUpperCase()}${node.elements[0]!.slice(1)} Champion`
  if (node.kind === 'guardian') return `${['Opening', 'Middle', 'Final stretch'][node.sector]} Guardian`
  return `Squad ${node.localId.slice(1, -1)}${node.column === 0 ? 'A' : 'B'}`
}
export function openPuzzleNode(checkpoint: PuzzleCheckpointSaveV1) {
  const id = parsePuzzleCampaignId(checkpoint.open?.input.battleId)
  return id?.kind === 'battle' ? puzzleChapter(id.scenarioId).nodes.find(n => n.localId === id.localId) ?? null : null
}
export function puzzleRewardEstimate(node: PuzzleMapNode, scenarioId: string, account: PuzzleAccount, variant: 'pace' | 'late' | null) {
  return puzzleEncounterRewards(node, variant).map(r => {
    const itemId = puzzleMaterialId(scenarioId, r.style), repaid = Math.min(r.quantity, Math.max(0, -(account.bank?.balances[itemId] ?? 0)))
    return { itemId, style: r.style, gross: r.quantity, repaid, net: r.quantity - repaid }
  })
}
export function replacePuzzleSlot(party: PuzzlePresetSaveV1, slot: number, outfit: PuzzleOutfitSaveV1 | null) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= party.slots.length) throw new Error('Unknown party slot')
  if (outfit && party.slots.some((s, i) => i !== slot && s?.outfitId === outfit.outfitId)) throw new Error('An outfit cannot fill two slots')
  return { ...party, slots: party.slots.map((s, i) => i === slot ? outfit ? { outfitId: outfit.outfitId, kit: outfit.kit } : null : s) }
}
