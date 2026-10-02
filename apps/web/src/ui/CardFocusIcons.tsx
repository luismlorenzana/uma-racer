// A card's running-style and distance focus as icons, readable at stat-icon size (D201, D238).

import type { DistanceCategory, Strategy } from '@racer/domain'
import { useId } from 'react'

/**
 * Running styles as two white letters on a coloured tile, built like the stat icons (rim, top-to-bottom gradient), in four
 * hues that no stat icon uses, so a card's type and its style never read as one another.
 */
export const RUNNING_STYLE_ICONS: Record<Strategy, { letters: string; label: string; rim: string; top: string; bottom: string }> = {
  front: { letters: 'FR', label: 'Front Runner', rim: '#7f1d1d', top: '#ef5350', bottom: '#c62828' },
  pace: { letters: 'PC', label: 'Pace Chaser', rim: '#4a148c', top: '#ab47bc', bottom: '#7b1fa2' },
  late: { letters: 'LS', label: 'Late Surger', rim: '#004d40', top: '#26a69a', bottom: '#00796b' },
  end: { letters: 'EC', label: 'End Closer', rim: '#1a1f5e', top: '#5c6bc0', bottom: '#283593' },
}

export function RunningStyleIcon({
  style,
  size = 20,
  title,
  className = '',
}: {
  style: Strategy
  size?: number
  /** The accessible name; without one the icon is decorative and sits beside a visible label. */
  title?: string
  className?: string
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const icon = RUNNING_STYLE_ICONS[style]
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role={title ? 'img' : undefined} aria-label={title}
      aria-hidden={title ? undefined : true} className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="45">
          <stop offset="0" stopColor={icon.top} />
          <stop offset="1" stopColor={icon.bottom} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="10" fill={icon.rim} />
      <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="8.8" fill={`url(#${id}-g)`} />
      {/* A rim-coloured stroke under the fill thickens the letters, so two of them still read at 14 px. */}
      <text x="24" y="32.6" textAnchor="middle" fontSize="23" fontWeight="800" letterSpacing="-0.6" fill="#ffffff"
        stroke={icon.rim} strokeWidth="1.6" strokeLinejoin="round" paintOrder="stroke"
        style={{ fontFamily: 'var(--font-display)' }}>
        {icon.letters}
      </text>
    </svg>
  )
}

/**
 * Distances as the original's running shoes (Sprint, Mile, Medium and Long shoes), redrawn as one bold sneaker on the
 * original's yellow item tile so the shoe's colour carries at 16 px. Colours are sampled from the original's icons.
 */
export const DISTANCE_ICONS: Record<DistanceCategory, { label: string; body: string; shade: string; light: string; accent: string; lace: string }> = {
  sprint: { label: 'Sprint', body: '#ff78a8', shade: '#d84878', light: '#ffb3cc', accent: '#303030', lace: '#303030' },
  mile: { label: 'Mile', body: '#c0f060', shade: '#8fc23c', light: '#e4ffa8', accent: '#486078', lace: '#1f3a4f' },
  medium: { label: 'Medium', body: '#ffc000', shade: '#f09018', light: '#ffe27a', accent: '#5f8fd6', lace: '#3b5f9e' },
  long: { label: 'Long', body: '#3078c0', shade: '#304890', light: '#7fb3e8', accent: '#f4f4f6', lace: '#1c2c5c' },
}

const TILE = { rim: '#b0a2aa', inner: '#f2e6ea', top: '#fbf7bf', bottom: '#f3ea68' }
const OUTLINE = '#4a0a30'
const SOLE = { fill: '#d4cfd8', shade: '#a9a3b2' }

const UPPER = 'M6.8 30.6 L7.6 19.4 C7.8 17 9.9 15.7 12.1 16.5 L16.3 18.2 C18.1 18.9 19.5 18.2 19.9 16.4 L20.8 12.7 C21.1 11.4 22.4 10.7 23.7 11.1 L26.6 12 C28 12.5 28.6 13.7 28.3 15.1 L27.9 17.1 C32.6 18.7 37.6 21.4 40.6 25 C42.2 26.9 42.6 29 41.9 30.6 Z'
const SOLE_PATH = 'M6.4 30.6 H38.9 C41.8 30.6 43.5 32.3 42.9 34.5 C42.4 36.3 40.9 37.5 38.9 37.5 H9.5 C7.6 37.5 6 35.9 6 34 Z'
// The heel panel and a stripe up the side, in the shoe's accent colour.
const HEEL = 'M7.3 23.2 C10.6 23.6 14.4 25.2 17.4 27.6 C18.6 28.6 19.4 29.6 19.9 30.6 H6.9 Z'
const STRIPE = 'M19.6 29.8 L27.2 18.9 L30.4 20.1 L23.6 30.6 Z'

export function DistanceTypeIcon({
  distance,
  size = 20,
  title,
  className = '',
}: {
  distance: DistanceCategory
  size?: number
  /** The accessible name; without one the icon is decorative and sits beside a visible label. */
  title?: string
  className?: string
}) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const shoe = DISTANCE_ICONS[distance]
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role={title ? 'img' : undefined} aria-label={title}
      aria-hidden={title ? undefined : true} className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="45">
          <stop offset="0" stopColor={TILE.top} />
          <stop offset="1" stopColor={TILE.bottom} />
        </linearGradient>
        <clipPath id={`${id}-u`}><path d={UPPER} /></clipPath>
        <clipPath id={`${id}-t`}><rect x="4" y="4" width="40" height="40" rx="7.6" /></clipPath>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="10" fill={TILE.rim} />
      <rect x="2.4" y="2.4" width="43.2" height="43.2" rx="8.9" fill={TILE.inner} />
      <rect x="4" y="4" width="40" height="40" rx="7.6" fill={`url(#${id}-g)`} />
      {/* The shoe stays on the yellow ground, inside the frame. */}
      <g clipPath={`url(#${id}-t)`}>
        <g transform="translate(24 25.6) rotate(10) scale(0.9) translate(-24.4 -24.3)">
          {/* The original's thick dark outline: the whole silhouette, stroked, under the fills. */}
          <path d={`${UPPER} ${SOLE_PATH}`} fill={OUTLINE} stroke={OUTLINE} strokeWidth="4.2" strokeLinejoin="round" />
          <path d={SOLE_PATH} fill={SOLE.fill} />
          <path d="M8.6 35.2 H39.6" stroke={SOLE.shade} strokeWidth="1.8" strokeLinecap="round" />
          <path d={UPPER} fill={shoe.body} />
          <g clipPath={`url(#${id}-u)`}>
            <path d="M6 27.6 C16 28.6 30 28.4 44 27.4 V31 H6 Z" fill={shoe.shade} />
            <path d={HEEL} fill={shoe.accent} />
            <path d={STRIPE} fill={shoe.accent} />
            <path d="M31.4 20.6 C35.6 22.2 39 24.6 40.8 27.4" fill="none" stroke={shoe.light} strokeWidth="2.2" strokeLinecap="round" />
          </g>
          {/* Laces across the tongue. */}
          <path d="M22.4 14.6 L26.6 16.4 M25.4 17.6 L29.6 19.2 M28.6 20.4 L32.4 21.8" stroke={shoe.lace} strokeWidth="1.9" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
