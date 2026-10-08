// Original five-element glyphs, never colour alone (docs/design/uma-puzzles.md §9).
import type { PuzzleElement } from '@racer/domain'
export const PUZZLE_ELEMENT_LABEL = { fire: 'Fire', water: 'Water', wood: 'Wood', light: 'Light', dark: 'Dark' } as const
export const PUZZLE_ELEMENT_TONE = { fire: 'text-puzzle-fire', water: 'text-puzzle-water', wood: 'text-puzzle-wood', light: 'text-puzzle-light', dark: 'text-puzzle-dark' } as const
export function PuzzleElementMark({ element, label = false, className = '', size = 20 }: { element: PuzzleElement; label?: boolean; className?: string; size?: number }) {
  return <span role="img" aria-label={PUZZLE_ELEMENT_LABEL[element]} className={`inline-flex items-center gap-1 ${PUZZLE_ELEMENT_TONE[element]} ${className}`}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {element === 'fire' ? <path d="M12 2c2 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4 2-3 2-6 1-10Z" /> :
        element === 'water' ? <><path d="M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z" /><path d="M8 15c0 2 1 3 3 3" /></> :
          element === 'wood' ? <><path d="M20 3C10 2 4 6 4 13a6 6 0 0 0 6 6c7 0 10-6 10-16Z" /><path d="m4 21 11-11m-6 6v-6m3 3h5" /></> :
            element === 'light' ? <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /> : <path d="M19 16a8 8 0 0 1-11-11 8 8 0 1 0 11 11Z" />}
    </svg>{label && <span>{PUZZLE_ELEMENT_LABEL[element]}</span>}
  </span>
}
