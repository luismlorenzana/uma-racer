// The build's operations, declared by T152 (D381) and refusing until T153 writes their rules
// (docs/tasks/T153-the-build.md): the deck, posting, the tree, bonds and skills.
import { notBuiltYet, type AnyOperationDef } from '../save/registry'

export const BUILD_OPERATIONS: readonly AnyOperationDef[] = [
  notBuiltYet('set-deck', 'T153'),
  notBuiltYet('post-card', 'T153'),
  notBuiltYet('buy-pips', 'T153'),
  notBuiltYet('pour-bond', 'T153'),
  notBuiltYet('buy-skill', 'T153'),
]
