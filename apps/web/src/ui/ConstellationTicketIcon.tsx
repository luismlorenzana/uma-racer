// Original vectors: a star-punched ticket and four shape-readable strategy glyphs (Uma Puzzles §9).
import type { Strategy } from '@racer/domain'
export const TICKET_STYLE_COLOUR = { front: '#bf6a26', pace: '#276bb4', late: '#9360b5', end: '#596779' } as const
export const TICKET_STYLE_NAME = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' } as const
export function ConstellationTicketIcon({ style, tier, size = 32 }: { style: Strategy; tier?: number; size?: number }) {
  return <svg role="img" aria-label={`${TICKET_STYLE_NAME[style]} Constellation Ticket${tier ? `, scenario ${tier}` : ''}`} width={size} height={size} viewBox="0 0 48 48" className="shrink-0">
    <path d="M9 5h30l5 7v8a5 5 0 0 0 0 10v8l-5 5H9l-5-5v-8a5 5 0 0 0 0-10v-8Z" fill={TICKET_STYLE_COLOUR[style]} stroke="currentColor" strokeWidth="1.5" />
    <path d="m14 7 2 4 5 .7-3.5 3.3.8 4.8-4.3-2.3-4.3 2.3.8-4.8L8 11.7l4-.7Z" fill="#fff" />
    {/* The existing race glyph: the large runner's place in a four-runner field, not tiny FR/PC/LS/EC text. */}
    <path d="M22 34h17" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    {[23, 28, 33, 38].map((x, i) => <circle key={x} cx={x} cy="27" r={i === ({ front: 3, pace: 2, late: 1, end: 0 }[style]) ? 3.4 : 1.1} fill="#fff" />)}
    {tier !== undefined && <g><path d="M5 29h13v12l-6.5 4L5 41Z" fill="#f4e3ba" stroke="#3c4655" strokeWidth="1.5" />{[0, 1, 2, 3].map(i => <circle key={i} cx={8 + i % 2 * 6} cy={33 + Math.floor(i / 2) * 6} r="1.6" fill={tier & 1 << i ? '#3c4655' : 'none'} stroke="#3c4655" strokeWidth="0.8" />)}</g>}
  </svg>
}
export function TicketStyleLegend() {
  return <details className="rounded-sm border border-current/20 px-3"><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">Ticket styles (not combat elements)</summary><div className="grid grid-cols-4 gap-2 pb-3 text-center text-xs">{(['front', 'pace', 'late', 'end'] as const).map(style => <div key={style} className="grid justify-items-center gap-1"><ConstellationTicketIcon style={style} />{TICKET_STYLE_NAME[style]}</div>)}</div><p className="pb-3 text-xs">Style tickets follow original A running aptitudes. Fire, Water, Wood, Light and Dark are separate combat elements.</p></details>
}
