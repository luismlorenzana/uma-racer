// Development-only automation controls for the Spark Rival touch proof (docs/design/minigame-kit.md, D185).
import {
  SPARK_RIVAL_BOARD_WIDTH,
  applySparkPath,
  createSparkRivalState,
  reduceSparkRival,
  sparkIndexCell,
  syntheticSparkEncounter,
  type SparkRivalAction,
  type SparkRivalResolution,
} from '@racer/domain'
import { SparkRivalScene, type SparkRivalHud } from './SparkRivalScene'

const PROOF_SEED = 'spark-rival-touch-proof-v1'

export class SparkRivalProofScene extends SparkRivalScene {
  constructor(onHud: (hud: SparkRivalHud) => void) {
    super(onHud, {
      encounter: syntheticSparkEncounter({ scenarioTier: 7, trainingLevel: 5, traineeBest: 'pace' }),
      seed: PROOF_SEED,
    })
  }

  reset(): void {
    if (this.inputLocked) return
    this.controller.cancel()
    this.state = createSparkRivalState(this.encounter, this.seed)
    this.previewBoard = this.state.board
    this.actionCount = 0
    this.status = 'Proof reset to the same seed and board.'
    this.renderBoard(this.state.board)
    this.emitHud()
  }

  playBestAdjacentDemo(): void {
    if (this.inputLocked || this.controller.snapshot || this.state.outcome) return
    const best = this.bestAdjacentAction()
    if (best) void this.resolveAction(best.action)
  }

  toggleHeldDemo(): void {
    if (this.inputLocked || this.state.outcome) return
    if (this.controller.snapshot) {
      this.controller.cancel()
      this.previewBoard = this.state.board
      this.status = 'Held proof cancelled; no action reached the engine.'
      this.renderBoard(this.state.board)
      this.emitHud()
      return
    }
    const best = this.bestAdjacentAction()
    if (!best || best.action.type !== 'drag') return
    const [from, to] = best.action.path
    if (!from || !to) return
    this.controller.begin(-1, from)
    this.controller.move(-1, to, performance.now())
    this.pointerX = this.geometry.left + (to.column + 0.5) * this.geometry.cellSize
    this.pointerY = this.geometry.top + (to.row + 0.5) * this.geometry.cellSize
    this.previewBoard = applySparkPath(this.state.board, best.action.path)
    this.status = 'Held-orb proof · displaced cell visible · cancel or wait for timeout.'
    this.renderBoard(this.previewBoard, to.row * SPARK_RIVAL_BOARD_WIDTH + to.column)
    this.emitHud()
  }

  private bestAdjacentAction(): { action: SparkRivalAction; resolution: SparkRivalResolution } | null {
    let best: { action: SparkRivalAction; resolution: SparkRivalResolution } | null = null
    for (let from = 0; from < 30; from += 1) for (let to = 0; to < 30; to += 1) {
      const left = sparkIndexCell(from)
      const right = sparkIndexCell(to)
      if (Math.max(Math.abs(left.row - right.row), Math.abs(left.column - right.column)) !== 1) continue
      const action = { type: 'drag' as const, path: [left, right], movementMs: 320 }
      const candidate = reduceSparkRival(this.encounter, this.state, action, this.actionCount)
      if (!best || candidate.resolution.combos > best.resolution.combos) best = { action, resolution: candidate.resolution }
    }
    return best
  }
}
