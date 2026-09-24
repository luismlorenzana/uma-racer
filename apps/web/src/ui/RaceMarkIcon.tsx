/**
 * Line icons for what a race counts toward: a career goal (flag), a leg of a G1 set (crown) and a first G1 win
 * (trophy). 24 px grid, 1.75 px strokes, rounded joins (docs/design/visual-system.md#iconography).
 */
const PATHS = {
  goal: 'M6 21V4m0 0h10.5l-2 3.5 2 3.5H6',
  set: 'M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10zM5 20.5h14',
  trophy: 'M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5M12 13.5V17m-3.5 3.5h7L14 17h-4z',
} as const

export type RaceMarkKind = keyof typeof PATHS

export function RaceMarkIcon({ kind, label, className = 'h-3.5 w-3.5' }: { kind: RaceMarkKind; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} className={className} fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind]} />
    </svg>
  )
}
