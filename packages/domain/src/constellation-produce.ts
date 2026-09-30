// Pure Produce-node command resolution (docs/design/farm.md#constellation-produce-bridge).

import { constellationTemplate, isNodeUnlocked, produceAssignmentRevision, type NodeAssignment, type ProduceAssignment } from './constellation'
import { farmCropById } from './farm/catalog'
import { FARM_SAFE_ID_PATTERN, type ConstellationProduceMovement, type FarmCropId } from './farm/types'

export interface ResolveConstellationProduceInput {
  umaId: string
  tier: number
  trainingLevel: number
  nodeId: string
  itemId: string
  quantity: number
  current: NodeAssignment | undefined
  expectedRevision: number
  now: number
}

export interface ConstellationProduceCommand {
  assignment: ProduceAssignment
  movement: ConstellationProduceMovement
  quantityBefore: number
  quantityAfter: number
}

export class ConstellationProduceConflictError extends Error {
  constructor() {
    super('That Produce node changed; reload its current assignment')
    this.name = 'ConstellationProduceConflictError'
  }
}

export const constellationProduceMovementId = (
  umaId: string,
  tier: number,
  nodeId: string,
  revision: number,
): string => `produce:${umaId}:${tier}:${nodeId}:${revision}`

const safeNonNegative = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

/** Validate one stocked fill/replacement and describe the assignment plus its append-only -1 evidence. */
export function resolveConstellationProduce(input: ResolveConstellationProduceInput): ConstellationProduceCommand {
  if (!FARM_SAFE_ID_PATTERN.test(input.umaId) || !FARM_SAFE_ID_PATTERN.test(input.nodeId)) {
    throw new Error('Produce command target is invalid')
  }
  if (!Number.isSafeInteger(input.tier) || input.tier < 1 || input.tier > 14 ||
    !Number.isSafeInteger(input.trainingLevel) || input.trainingLevel < 1 || input.trainingLevel > 10 ||
    !safeNonNegative(input.expectedRevision) || !safeNonNegative(input.now)) {
    throw new Error('Produce command bounds are invalid')
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error('That crop is out of stock')

  const template = constellationTemplate(input.tier)
  const node = template.nodes.find((candidate) => candidate.id === input.nodeId)
  if (!node || node.kind !== 'stat') throw new Error('That node is not a Produce node')
  if (!isNodeUnlocked(template, node, input.trainingLevel)) throw new Error('That Produce node is still locked')

  const crop = farmCropById(input.itemId)
  if (!crop) throw new Error('That crop is unknown')
  if (crop.scenarioTier !== input.tier) throw new Error('That crop belongs to another scenario')

  const currentRevision = produceAssignmentRevision(input.current)
  if (currentRevision === null) throw new Error('That node does not hold Produce')
  if (currentRevision !== input.expectedRevision) throw new ConstellationProduceConflictError()
  const revision = currentRevision + 1
  if (!Number.isSafeInteger(revision)) throw new Error('Produce replacement revision overflow')

  const movementId = constellationProduceMovementId(input.umaId, input.tier, input.nodeId, revision)
  if (!FARM_SAFE_ID_PATTERN.test(movementId)) throw new Error('Produce evidence id is too long')
  const itemId = crop.id as FarmCropId
  const assignment: ProduceAssignment = { kind: 'produce', itemId, revision }
  const movement: ConstellationProduceMovement = {
    id: movementId,
    itemId,
    delta: -1,
    reason: 'constellation-produce',
    source: {
      kind: 'constellation-produce',
      umaId: input.umaId,
      tier: input.tier,
      nodeId: input.nodeId,
      revision,
    },
    createdAt: input.now,
  }
  return { assignment, movement, quantityBefore: input.quantity, quantityAfter: input.quantity - 1 }
}
