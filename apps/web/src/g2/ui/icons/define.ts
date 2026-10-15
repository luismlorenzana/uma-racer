// The new game's own icons (T137), drawn with today's `defineIcon` on the same 24 grid (docs/design/visual-system.md
// #iconography). Their names live here rather than in today's `IconName` union, whose test holds today's set to its own
// modules; T143 moves them into `ui/icons` with the rest of `g2/`.
import { defineIcon, type IconComponent, type IconName } from '../../../ui/icons'

export const G2_ICON_NAMES = Object.freeze(['coin', 'menu', 'info'] as const)
export type G2IconName = (typeof G2_ICON_NAMES)[number]

type Drawing = Parameters<typeof defineIcon>[1]

/** `defineIcon` under a g2 name: the name only marks the SVG (`data-icon`), so the cast changes nothing else. */
export const defineG2Icon = (name: G2IconName, drawing: Drawing): IconComponent => defineIcon(name as unknown as IconName, drawing)
