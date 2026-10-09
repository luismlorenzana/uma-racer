// Invented DEV-only account/portraits, never a production fallback (T112 phone proof).
import { applyPuzzleTerminal, createPuzzleCheckpoint, createPuzzleSource, createUmaSave, defaultPuzzleKit, enrollPuzzleOutfit,
  freezePuzzleEncounter, puzzleCampaignId, puzzleChapter, puzzleChapterStatus, puzzleData, puzzlePayloadHash, puzzleStats,
  PUZZLE_ELEMENTS, PUZZLE_FOE_ROLES, PUZZLE_PARTY_IDS, type PuzzleCheckpointSaveV1, type PuzzleOutfitSaveV1,
  type PuzzlePresetSaveV1, type PuzzleStoredEntity, type UmaTemplate } from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'
import { emptyPuzzleParty } from '../../game/puzzles/host'
const names = ['Amber Ribbon', 'Blue Bell', 'Cedar Step', 'Dawn Runner', 'Evening Star', 'Frost Ribbon', 'Golden Clover', 'Hazel Wind', 'Indigo Wish', 'Jade Wing', 'Lilac Noon', 'Quiet Comet']
export const proofIdentity = { version: 'invented-ui-cast-v1', contentHash: 'c'.repeat(64) }
export const proofCast = { schemaVersion: 1 as const, manifestVersion: `puzzles-${proofIdentity.contentHash}`,
  members: [{ id: 'invented-ui-sprite', elements: [...PUZZLE_ELEMENTS], roles: [...PUZZLE_FOE_ROLES] }] }
export function puzzleUiProofData(variant: 'default' | 'setup' | 'first-use' = 'default') {
  const templates: UmaTemplate[] = names.map((name, i) => ({ id: `invented-ui-${i}`, charaId: `invented-character-${Math.floor(i / 2)}`, name,
    outfit: 'Original DEV placeholder', jpRelease: '2000-01-01', globalRelease: null, starter: true,
    baseStats: { speed: 100 + i * 3, stamina: 150 + i * 4, power: 90, guts: 75, wit: 90 },
    growthRates: { speed: 0.1, stamina: 0.1, power: 0, guts: 0, wit: 0.1 },
    aptitudes: { surface: { turf: 'A', dirt: i % 3 === 0 ? 'A' : 'B' }, distance: { sprint: 'B', mile: 'A', medium: 'B', long: 'C' },
      strategy: { front: i % 4 === 0 ? 'A' : 'B', pace: i % 4 === 1 ? 'A' : 'B', late: i % 4 === 2 ? 'A' : 'B', end: i % 4 === 3 && i !== 11 ? 'A' : 'B' } },
    uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/invented' }))
  const sources = templates.map(t => createPuzzleSource(t, 'invented-ui-source-v1'))
  const outfits: PuzzleOutfitSaveV1[] = sources.slice(0, 10).map((source, i) => ({ schemaVersion: 1, outfitId: source.templateId,
    enrollment: { ...enrollPuzzleOutfit(source, source.aptitudes.surface.dirt === 'A' ? PUZZLE_ELEMENTS[i % 5]! : i % 4 === 0 ? 'light' : i % 4 === 3 ? 'dark' : i % 2 ? 'water' : 'wood'), level: i < 5 ? 10 : 5, exp: 10 },
    kit: { ...defaultPuzzleKit(source)!, patternId: i < 5 ? 'puzzle:row' : 'puzzle:four' }, revision: 1 }))
  const parties: PuzzlePresetSaveV1[] = PUZZLE_PARTY_IDS.map(emptyPuzzleParty)
  parties[0] = { ...parties[0]!, name: 'First Lights', slots: outfits.slice(0, 5).map(o => ({ outfitId: o.outfitId, kit: o.kit })), foregroundChapter: puzzleCampaignId({ kind: 'chapter', scenarioId: 'ura-finale' }), revision: 1 }
  parties[1] = { ...parties[1]!, name: 'Next Horizons', revision: 1 }
  parties[2] = { ...parties[2]!, name: 'Distant Stars', slots: outfits.slice(5, 10).map(o => ({ outfitId: o.outfitId, kit: o.kit })), foregroundChapter: puzzleCampaignId({ kind: 'chapter', scenarioId: 'ura-finale' }), revision: 1 }
  const chapter = puzzleChapter('ura-finale'), party = parties[0]!
  let progress = createPuzzleCheckpoint(chapter, party.partyId)
  // The whole v2 stage line to the Finals (D301).
  for (const node of chapter.nodes.filter(n => n.kind !== 'champion')) {
    progress = applyPuzzleTerminal(chapter, progress, { schemaVersion: 1, scenarioId: chapter.scenarioId, partyId: party.partyId, nodeId: node.id,
      battleId: puzzleCampaignId({ kind: 'battle', partyId: party.partyId, scenarioId: chapter.scenarioId, localId: node.localId, attempt: 0 }), attempt: 0, outcome: 'win' })
  }
  const checkpoint: PuzzleCheckpointSaveV1 = { schemaVersion: 1, checkpointId: puzzleCampaignId({ kind: 'checkpoint', scenarioId: chapter.scenarioId, partyId: party.partyId }),
    scenarioId: chapter.scenarioId, progress, reached: puzzleChapterStatus(chapter, progress).reached, open: null, revision: 1 }
  const foreign = parties[2]!, foreignProgress = createPuzzleCheckpoint(chapter, foreign.partyId)
  const input = freezePuzzleEncounter({ chapter, checkpoint: foreignProgress, nodeId: chapter.nodes[0]!.id, entrants: foreign.slots.map(s => {
    const o = outfits.find(o => o.outfitId === s!.outfitId)!; return { outfitId: o.outfitId, source: o.enrollment.source, level: o.enrollment.level, element: o.enrollment.element, kit: s!.kit, stats: puzzleStats(o.enrollment.source, o.enrollment.level) }
  }), leaderId: foreign.leaderId, cast: proofCast, accountSeed: 'invented-ui-cutover', ownerEpoch: 1, darkVariant: null })
  for (const o of outfits.slice(5)) o.enrollment.firstBattleId = input.battleId
  const foreignCheckpoint: PuzzleCheckpointSaveV1 = { ...checkpoint, checkpointId: input.checkpointId, progress: foreignProgress,
    reached: puzzleChapterStatus(chapter, foreignProgress).reached, open: { schemaVersion: 1, deviceId: 'invented-other-device', ownerEpoch: 1, input, inputHash: puzzlePayloadHash(input), content: proofIdentity } }
  const rows: PuzzleStoredEntity[] = []
  const put = (kind: string, id: string, data: object) => rows.push({ kind, id, data: puzzleData(data), version: 1, deleted: false, updatedAt: 1 })
  templates.forEach((t, i) => { const uma = createUmaSave(t); if (i === 4) uma.scenarios[0]!.trainingLevel = 9; put('umas', t.id, uma) }); outfits.forEach(o => put('puzzleOutfits', o.outfitId, o)); parties.forEach(p => put('puzzlePresets', p.partyId, p))
  for (const [itemId, quantity] of Object.entries({ 'constellation:ura-finale:front': 5, 'constellation:ura-finale:pace': 6,
    'constellation:unity-cup:front': 6, 'constellation:unity-cup:pace': 3, 'training:level-up-ticket': 2, 'constellation:invented-future:front': 1 })) put('items', itemId, { itemId, quantity, updatedAt: 1 })
  put('constellationBank', 'main', { schemaVersion: 1, cutoverVersion: 1, cutoverId: 'invented-ui-cutover', phase: 'active', cohortCount: 1, completedCount: 1,
    debitLimits: { 'constellation:ura-finale:front': 7 }, balances: { 'constellation:ura-finale:front': -7 }, openingClears: ['unity-cup'], revision: 1 })
  put('puzzleCheckpoints', checkpoint.checkpointId, checkpoint); put('puzzleCheckpoints', foreignCheckpoint.checkpointId, foreignCheckpoint)
  const frames = Object.fromEntries(templates.map((t, i) => [t.id, { page: 0, x: i * 128, y: 0, width: 128 as const, height: 128 as const }]))
  const palette = ['#b87564', '#607da2', '#668567', '#b5a46b', '#8a769b']
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="128">${templates.map((_, i) => `<g transform="translate(${i * 128})"><rect width="128" height="128" rx="16" fill="${palette[i % 5]}"/><path d="M30 125V77Q25 38 47 28L43 8 61 25H76L90 8 89 33Q108 53 95 80V125" fill="#263142"/><ellipse cx="66" cy="66" rx="27" ry="33" fill="#ead5c5"/><path d="M36 51Q47 17 71 32L100 61 78 48 64 52 50 44Z" fill="#263142"/><circle cx="56" cy="66" r="3" fill="#263142"/><circle cx="76" cy="66" r="3" fill="#263142"/><path d="M59 82Q65 87 72 82" fill="none" stroke="#263142" stroke-width="3"/></g>`).join('')}</svg>`
  const atlas = { descriptor: { schemaVersion: 1 as const, kind: 'uma-icons' as const, frameWidth: 128 as const, frameHeight: 128 as const,
    pages: [{ path: 'invented-ui.svg', width: 1536, height: 128, sha256: 'd'.repeat(64) }], frames }, pageUrls: [`data:image/svg+xml,${encodeURIComponent(svg)}`] }
  const content: LoadedContent = { manifest: { version: 'invented-ui-source-v1', generatedAt: '', source: {}, files: [] }, origin: 'network', sparkRivals: null,
    umas: { items: templates, byId: new Map(templates.map(t => [t.id, t])) }, cards: { items: [], byId: new Map() }, skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
    atlases: { 'uma-icons': atlas, 'card-icons': { ...atlas, descriptor: { ...atlas.descriptor, kind: 'card-icons' } } }, art: { has: () => false, load: async () => null } }
  if (variant === 'setup') {
    const source = sources[10]!
    put('puzzleOutfits', source.templateId, { schemaVersion: 1, outfitId: source.templateId,
      enrollment: { ...enrollPuzzleOutfit(source, 'fire'), level: 15, exp: 30 }, kit: defaultPuzzleKit(source)!, revision: 1 })
  }
  const proofRows = variant === 'first-use' ? rows.filter(r => r.kind !== 'puzzleOutfits' && r.kind !== 'puzzleCheckpoints').map(r =>
    r.kind === 'puzzlePresets' ? { ...r, data: puzzleData(emptyPuzzleParty(r.id)) } : r) : rows
  return { rows: proofRows, content, sources }
}
