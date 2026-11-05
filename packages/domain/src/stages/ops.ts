// The stages' operation, declared by T152 (D381) and refusing until T155 writes the framework
// (docs/tasks/T155-stages-and-training-yard.md): settling a played stage from its seed and journal.
import { notBuiltYet, type AnyOperationDef } from '../save/registry'

export const STAGE_OPERATIONS: readonly AnyOperationDef[] = [
  notBuiltYet('settle-stage', 'T155'),
]
