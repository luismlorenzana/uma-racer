// Slot/gold unlocks spend one scenario token locally and sync like any Item movement (D250, D263).
import { inspirationSpendId, inspirationTokenId, openInspiration, parseUmaSave, trainedScenario,
  type UmaTemplate, type SkillTemplate, type InspirationMovement, type InspirationSlot } from '@racer/domain'
import { db, type RacerDb } from './db'
import { queueInTransaction } from './persistence'

export async function reserveInspirationUnlock(input: { umaId: string; tier: number; nodeId: string; goldIndex: number | null },
  content: { umas: ReadonlyMap<string, UmaTemplate>; skills: ReadonlyMap<string, SkillTemplate> }, database: RacerDb = db, now = Date.now()): Promise<void> {
  await database.transaction('rw', [database.umas, database.items, database.itemLedger, database.pendingRpgCommands, database.outbox], async () => {
    const id = inspirationSpendId(input.umaId, input.tier, input.nodeId, input.goldIndex)
    if (await database.itemLedger.get(id)) return
    const row = await database.umas.get(input.umaId), uma = row && parseUmaSave(row.data)
    if (!row || !uma || !uma.scenarios.some(r => r.tier === input.tier)) throw new Error('Owned scenario unavailable')
    const run = trainedScenario(uma, input.tier)
    const inspiration = openInspiration(run.inspiration, input.nodeId, input.goldIndex)
    if (input.goldIndex !== null) {
      const assignment = run.assignments[input.nodeId]
      const ancestor = assignment?.kind === 'lineage' ? content.umas.get(assignment.templateId) : null
      const golds = ancestor?.awakeningSkillIds.filter(id => content.skills.get(id)?.kind === 'gold') ?? []
      if (!golds[input.goldIndex]) throw new Error('Choose an ancestor with this natural gold first')
    }
    const kind = input.goldIndex === null ? 'slot' : 'skill', itemId = inspirationTokenId(input.tier, kind)
    const stack = await database.items.get(itemId)
    if (!stack || stack.data.quantity < 1) throw new Error(`No ${kind} tokens for this scenario`)
    const movement: InspirationMovement = { id, itemId, delta: -1, reason: 'inspiration-unlock', createdAt: now,
      source: { kind: 'inspiration-unlock', umaId: input.umaId, tier: input.tier,
        nodeId: input.nodeId as InspirationSlot, goldIndex: input.goldIndex } }
    const next = { ...uma, scenarios: uma.scenarios.map(r => r.tier === run.tier ? { ...r, inspiration } : r) }
    await database.umas.put({ ...row, data: next })
    await database.items.put({ ...stack, data: { ...stack.data, quantity: stack.data.quantity - 1, updatedAt: now } })
    await database.itemLedger.put({ id, data: movement, createdAt: now })
    await queueInTransaction('umas', row.id, 'upsert', now)
    await queueInTransaction('items', itemId, 'upsert', now)
    await queueInTransaction('itemLedger', id, 'append', now)
  })
}
