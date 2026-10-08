// Renderer adapter keeps Pixi out of the battle DOM module and provides a CPU-only test seam.
import type { PuzzleSceneOptions } from './PuzzleBattleScene'
export async function createPuzzleScene(options: PuzzleSceneOptions) {
  const { PuzzleBattleScene } = await import('./PuzzleBattleScene')
  return PuzzleBattleScene.create(options)
}
