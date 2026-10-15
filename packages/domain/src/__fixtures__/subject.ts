// Shared test fixture: the derived facts badge and loadout helpers read (D121).

import type { BadgeSubject } from '../badges'
import { zeroStats } from '../types'

export const subject = (over: Partial<BadgeSubject> = {}): BadgeSubject => ({
  tier: 1,
  stats: zeroStats(),
  library: [],
  ...over,
})
