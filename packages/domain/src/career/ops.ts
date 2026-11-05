// The career's operations, declared by T152 (D381) and refusing until T154 writes their rules
// (docs/tasks/T154-the-career.md): starting a career, racing an objective, the next season and the finale.
import { notBuiltYet, type AnyOperationDef } from '../save/registry'

export const CAREER_OPERATIONS: readonly AnyOperationDef[] = [
  notBuiltYet('start-career', 'T154'),
  notBuiltYet('run-race', 'T154'),
  notBuiltYet('next-season', 'T154'),
  notBuiltYet('run-finale', 'T154'),
]
