import type { SupportCardTemplate } from '@racer/domain'
import { useId, type ReactNode } from 'react'

export type TypeIconKind = SupportCardTemplate['type']

/**
 * The app's one set of stat and card-type icons (D183): our own drawings in the original's style, a rounded tile with a
 * darker rim, a top-to-bottom gradient and a white glyph, in the exact colours sampled from the original's icons.
 * Friend and Group are the original's light tiles with a coloured figure.
 */
export const TYPE_ICON_COLORS: Record<TypeIconKind, { rim: string; top: string; bottom: string; glyph: string; detail: string }> = {
  speed: { rim: '#0980e6', top: '#3eb9ff', bottom: '#1fa4fe', glyph: '#ffffff', detail: '#ffffff' },
  stamina: { rim: '#dd4433', top: '#ff8877', bottom: '#ff6655', glyph: '#ffffff', detail: '#ffffff' },
  power: { rim: '#e66e00', top: '#fcb80e', bottom: '#fc961f', glyph: '#ffffff', detail: '#ffffff' },
  guts: { rim: '#f1368b', top: '#ff8aae', bottom: '#ff609e', glyph: '#ffffff', detail: '#ffffff' },
  wit: { rim: '#05a371', top: '#1dd3a1', bottom: '#02be7a', glyph: '#ffffff', detail: '#ffffff' },
  friend: { rim: '#f6b23b', top: '#ffffee', bottom: '#fffde7', glyph: '#fcb818', detail: '#fffdeb' },
  group: { rim: '#5ab608', top: '#f8fcf0', bottom: '#eef9e0', glyph: '#4ccc08', detail: '#a0e83c' },
}

const LABEL: Record<TypeIconKind, string> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', friend: 'Friend', group: 'Group',
}

export const typeLabel = (type: TypeIconKind): string => LABEL[type]

/** A figure for Friend and Group: head, shoulders and a smile, cut from the tile's colour. */
function Figure({ x, y, scale, fill, face }: { x: number; y: number; scale: number; fill: string; face: string | null }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="0" cy="0" r="10" fill={fill} />
      <path d="M-13 27 L-8.6 12.4 C-6.2 10.2 -3.2 9.2 0 9.2 C3.2 9.2 6.2 10.2 8.6 12.4 L13 27 Z" fill={fill} />
      {face && (
        <>
          <circle cx="-3.9" cy="-1.4" r="1.5" fill={face} />
          <circle cx="3.9" cy="-1.4" r="1.5" fill={face} />
          <path d="M-5 2.6 C-2.8 5.4 2.8 5.4 5 2.6" fill="none" stroke={face} strokeWidth="1.9" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

/** Each type's glyph on a 48 grid. `ground` paints a cut-out in the tile's own gradient. */
function glyph(type: TypeIconKind, ground: string): ReactNode {
  const { glyph: ink, detail } = TYPE_ICON_COLORS[type]
  switch (type) {
    case 'speed':
      // A boot mid-stride, leaning forward: two bands across the shaft, and the sole apart from the foot.
      return (
        <g transform="rotate(12 24 24) translate(24 24) scale(0.9) translate(-24 -23)">
          <path d="M20.5 8.5 H36 V32 H12.6 C10 32 8 30 8 27.4 C8 24.7 10.2 22.6 12.9 22.4 L20.5 21.8 Z" fill={ink} />
          <rect x="19.5" y="12" width="17.5" height="2.3" fill={ground} />
          <rect x="19.5" y="16.6" width="17.5" height="2.3" fill={ground} />
          <rect x="7.4" y="34.4" width="29.2" height="3.8" rx="1.5" fill={ink} />
        </g>
      )
    case 'stamina':
      return <path d="M24 39.5 C12.8 31.8 8 25.6 8 18.8 C8 13.5 12 9.8 16.7 9.8 C19.9 9.8 22.5 11.6 24 14.3 C25.5 11.6 28.1 9.8 31.3 9.8 C36 9.8 40 13.5 40 18.8 C40 25.6 35.2 31.8 24 39.5 Z" fill={ink} />
    case 'power':
      // A flexed arm: the fist up, the forearm down to the elbow, the bicep swelling to the right, the elbow's crease.
      return (
        <>
          <path d="M13.5 39.5 V26.5 C13.5 22.3 15.1 18.7 17.8 16.2 L19 15.1 V11.6 C19 9.6 20.6 8 22.6 8 H26.6 C28.6 8 30.2 9.6 30.2 11.6 V13.6 C30.2 15.3 29 16.6 27.3 16.8 L24.7 17.2 L22.1 25.6 C24.5 23.7 27.6 22.9 30.6 23.5 C36 24.5 39.8 28.3 39.8 33 C39.8 36.6 37.2 39.5 33.7 39.5 Z" fill={ink} />
          <path d="M24.2 26.6 C26.1 27.9 26.9 30 26.4 32.4" fill="none" stroke={ground} strokeWidth="1.7" strokeLinecap="round" />
        </>
      )
    case 'guts':
      // A flame with a hollow heart and a small white core.
      return (
        <>
          <path d="M24 5.5 C26.6 12.2 35.2 16.8 35.2 27.6 C35.2 34.4 30.1 39.8 24 39.8 C17.9 39.8 12.8 34.4 12.8 27.6 C12.8 22.6 15.4 19 18.1 16.6 C18.2 20 19.4 22.4 21 23.4 C20.6 17 22 11 24 5.5 Z" fill={ink} />
          <path d="M24 22.6 C25.5 26.8 30.2 28.3 30.2 33 C30.2 36.5 27.5 38.8 24 38.8 C20.5 38.8 17.8 36.5 17.8 33 C17.8 30.5 19.2 28.8 20.5 27.8 C20.7 29.6 21.5 30.9 22.6 31.3 C22.4 28.2 23 25.3 24 22.6 Z" fill={ground} />
          <path d="M24 30.4 C24.9 32.4 26.8 33.3 26.8 35.4 C26.8 37 25.5 38.1 24 38.1 C22.5 38.1 21.2 37 21.2 35.5 C21.2 34.3 22 33.4 22.7 33 C22.9 34 23.3 34.5 23.8 34.7 C23.6 33.2 23.7 31.7 24 30.4 Z" fill={ink} />
        </>
      )
    case 'wit':
      // A mortarboard: the board, the cap under it, and its tassel.
      return (
        <g transform="rotate(-8 24 24)">
          <path d="M24 9 L42.2 16.5 L24 24 L5.8 16.5 Z" fill={ink} />
          <path d="M13 20.7 V29.4 C13 32.4 18 34.7 24 34.7 C30 34.7 35 32.4 35 29.4 V20.7 L24 25.3 Z" fill={ink} />
          <rect x="36.8" y="17.8" width="1.7" height="12" rx="0.8" fill={ink} />
          <rect x="35.4" y="29.2" width="4.6" height="8.4" rx="1.8" fill={ink} />
        </g>
      )
    case 'friend':
      return <Figure x={24} y={19.5} scale={1.05} fill={ink} face={detail} />
    case 'group':
      // Two friends behind, one in front.
      return (
        <>
          <Figure x={11} y={21} scale={0.72} fill={detail} face={null} />
          <Figure x={37} y={21} scale={0.72} fill={detail} face={null} />
          <Figure x={24} y={19.5} scale={0.98} fill={ink} face={TYPE_ICON_COLORS.group.top} />
        </>
      )
  }
}

/** A stat or a card type, as its tile. */
export function TypeIcon({
  type,
  size = 20,
  title,
  className = '',
}: {
  type: TypeIconKind
  size?: number
  /** The accessible name; without one the icon is decorative and sits beside a visible label. */
  title?: string
  className?: string
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const colors = TYPE_ICON_COLORS[type]
  // User-space gradient, so a cut-out painted with it matches the tile behind it at that height.
  const ground = `url(#${id}-g)`
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="45">
          <stop offset="0" stopColor={colors.top} />
          <stop offset="1" stopColor={colors.bottom} />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="8.8" />
        </clipPath>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="10" fill={colors.rim} />
      <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="8.8" fill={ground} />
      <g clipPath={`url(#${id}-c)`}>{glyph(type, ground)}</g>
    </svg>
  )
}
