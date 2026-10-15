// The re-authored trees' live blocks in docs/game/05-training-hub.md §4 (M033): the tree table and every drawing,
// rendered from the code so the page can't drift from it. Pure: no I/O.
import { SCENARIOS } from '../../scenarios'
import { TREE_ART, TREE_MOTIFS } from './shapes'
import { perCardCap, treeCardNodesAt } from './sizes'

/** The 15th has no row in today's scenario table until the platform publishes it (04 §2). */
const FIFTEENTH_SCENARIO = "Japan's 15th scenario"
const SCENARIOS_PER_TIER = 5

const scenarioName = (T: number): string => SCENARIOS[T - 1]?.name ?? FIFTEENTH_SCENARIO
const tierAndScenario = (T: number): string =>
  `${Math.ceil(T / SCENARIOS_PER_TIER)} · ${((T - 1) % SCENARIOS_PER_TIER) + 1}`

function table(head: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const cell = (value: string | number) => String(value).replace(/\|/g, '\\|')
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)]
    .join('\n')
}

/** 05 §4's table: every scenario's size, per-card cap and how its motif adapts. */
function trees(): string {
  return table(['#', 'Scenario', 'Tier · scenario', 'Nodes', 'Per-card cap', 'How the motif adapts'],
    TREE_MOTIFS.map((motif, i) => {
      const T = i + 1
      const N = treeCardNodesAt(T)
      return [T, scenarioName(T), tierAndScenario(T), N, perCardCap(N), motif]
    }))
}

/** Every drawing under its scenario's name, as `TREE_ART` holds it. */
function art(): string {
  return TREE_ART.map((drawing, i) => {
    const T = i + 1
    const lines = drawing.replace(/^\n/, '').replace(/\n\s*$/, '')
    return [`**${T} · ${scenarioName(T)}** · ${treeCardNodesAt(T)} card nodes`, '', '```text', lines, '```'].join('\n')
  }).join('\n\n')
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'constellation-trees': trees,
  'constellation-art': art,
}
