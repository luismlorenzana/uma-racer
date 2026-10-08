// Original SVG stand-ins approved while PAD source collection is deferred; NEVER a content-success/fallback signal.
import type { PuzzleElement } from '@racer/domain'
const colours: Record<PuzzleElement, string> = { fire: '#ef7945', water: '#56a9ef', wood: '#75bd75', light: '#eadbb3', dark: '#b096e4' }
export function PuzzleEnemyPlaceholder({ element }: { element: PuzzleElement }) {
  return <svg viewBox="0 0 160 160" role="img" aria-label={`${element} enemy placeholder`} className="h-full w-full">
    <ellipse cx="80" cy="138" rx="47" ry="7" fill="#000" opacity=".16" />
    <path d="M40 65 29 35 63 49 Q80 41 98 49 L131 35 120 65 Q142 122 108 133 L52 133 Q18 122 40 65Z" fill={colours[element]} stroke="#ffffff" strokeOpacity=".7" strokeWidth="3" />
    <ellipse cx="63" cy="88" rx="8" ry="11" fill="#243043" /><ellipse cx="99" cy="88" rx="8" ry="11" fill="#243043" />
    <circle cx="65" cy="85" r="3" fill="white" /><circle cx="101" cy="85" r="3" fill="white" />
    <path d="M70 111 Q80 121 90 111" fill="none" stroke="#243043" strokeWidth="4" strokeLinecap="round" />
    <path d="m80 56 7 10-7 10-7-10Z" fill="white" opacity=".8" />
  </svg>
}
