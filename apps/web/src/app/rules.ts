// The rules the shell runs on every snapshot, in the lazily loaded game chunk: the entry paints the frame first and the
// counts fill in when this arrives (T137 "Budget").
import { hubView } from '@racer/domain/hub'
import type { G2Rules } from './game'

export const RULES: G2Rules = Object.freeze({ hubView })
