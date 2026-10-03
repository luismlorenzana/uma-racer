// Original code-native inventory crests: linked ancestors versus a skill spark, not proprietary art (D250).
import type { InspirationTokenKind } from '@racer/domain'
export function InspirationTokenIcon({ kind, size = 44 }: { kind: InspirationTokenKind; size?: number }) {
  const slot = kind === 'slot'
  return <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={`Inspiration ${slot ? 'slot' : 'skill'} token`} className="inline-block shrink-0">
    <path d="M28 3 47 14v27L28 53 9 41V14Z" fill={slot ? '#456e93' : '#b57b24'} stroke={slot ? '#233e5a' : '#704719'} strokeWidth="3" />
    <path d="M28 8 42 17v21l-14 9-14-9V17Z" fill="none" stroke={slot ? '#b7d4ee' : '#ffe19b'} strokeWidth="2" />
    {slot ? <g fill="#e3f1ff" stroke="#e3f1ff" strokeWidth="2.5"><path d="M28 24v7m0 0H19v5m9-5h9v5" fill="none" /><circle cx="28" cy="20" r="5" /><circle cx="19" cy="38" r="4" /><circle cx="37" cy="38" r="4" /></g>
      : <g fill="#fff0c4"><path d="m28 15 4 9 10 4-10 4-4 10-4-10-10-4 10-4Z" /><circle cx="39" cy="17" r="2" /><circle cx="17" cy="39" r="2" /></g>}
  </svg>
}
