// DEV proof entry points must bypass account providers and service-worker registration (implementation §8).
// Call only under import.meta.env.DEV so these paths and their renderers are tree-shaken in production.
export function isDevPuzzleProofPath(path: string): boolean {
  return /^\/dev\/puzzles-(?:ui-proof|battle-proof|practice|preservation-proof|material-icons)(?:\/|$)/.test(path)
}
