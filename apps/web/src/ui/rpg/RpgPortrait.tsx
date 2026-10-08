// Reusable RPG outfit identity for party, map, battle and result (docs/design/uma-rpg.md#phone-presentation).
import type { RpgElement, RpgWeapon } from '@racer/domain'
import type { ReactNode } from 'react'
import type { LoadedContent } from '../../content/runtime'
import { getContentAsset } from '../../content/runtime'
import { AtlasSprite } from '../AtlasSprite'
import { Placeholder } from '../Placeholder'
import { useArt } from '../album/useArt'

export const RPG_WEAPON_LABELS: Record<RpgWeapon, string> = {
  greatsword: 'Greatsword', spear: 'Spear', axe: 'Axe', bow: 'Bow', 'short-sword': 'Short Sword',
  'mage-staff': 'Mage Staff', 'arcane-staff': 'Arcane Staff', 'cleric-staff': 'Cleric Staff', 'summoner-tome': 'Summoner Tome',
}
export const RPG_ELEMENT_LABELS: Record<RpgElement, string> = {
  fire: 'Fire', ice: 'Ice', lightning: 'Lightning', light: 'Light', dark: 'Dark',
}

/** Weapon families wear one color: Brawler red, Mage green, Arcane yellow, Cleric blue, Summoner purple. */
export const WEAPON_TONE: Readonly<Record<RpgWeapon, string>> = {
  greatsword: '#ff6b5e', spear: '#ff6b5e', axe: '#ff6b5e', bow: '#ff6b5e',
  'mage-staff': '#5fd38a', 'short-sword': '#5fd38a', 'arcane-staff': '#ffd54f', 'cleric-staff': '#6cb4ff', 'summoner-tome': '#c48bff',
}

const line = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' } as const
/** Filled silhouettes drawn upright on a 24-unit grid, then tilted: blades 45°, staves 25°. */
const WEAPON_ART: Readonly<Record<RpgWeapon, ReactNode>> = {
  greatsword: <g transform="rotate(45 12 12)">
    <path fillRule="evenodd" d="M12 .5 15 4v11H9V4Zm-.6 4v9h1.2v-9Z" />
    <rect x="4.5" y="15" width="15" height="2.2" rx="1.1" /><rect x="11" y="17.2" width="2" height="4.3" /><circle cx="12" cy="22.6" r="1.5" />
  </g>,
  spear: <g transform="rotate(45 12 12)">
    <path d="M12 .5c2.4 3 2.6 6.3.9 9.1h-1.8C9.4 6.8 9.6 3.5 12 .5Z" />
    <rect x="10.6" y="9.6" width="2.8" height="1.6" rx=".5" /><path d="m10.6 11.2-1.4 3.4 2-2.2Zm2.8 0 1.4 3.4-2-2.2Z" />
    <rect x="11.35" y="11.2" width="1.3" height="12.6" rx=".6" />
  </g>,
  axe: <g transform="rotate(35 12 12)">
    <rect x="11.2" y="3" width="1.6" height="20.5" rx=".8" />
    <path d="M12.8 4.5c3.7-1.3 7.7 1 8.4 5.5-.7 4.5-4.7 6.8-8.4 5.5Z" /><path d="m11.2 7-3.4 1.6v2.8l3.4 1.6Z" />
  </g>,
  bow: <g transform="rotate(-45 12 12)">
    <path {...line} strokeWidth="2.4" d="M6 2c9.5 4 9.5 16 0 20" /><path {...line} strokeWidth=".9" d="M6 2v20" />
    <path {...line} strokeWidth="1.4" d="M3.2 12h15.3" /><path d="m21.5 12-4-2.4v4.8ZM2.5 12l2.1-2.2h1.8L4.3 12l2.1 2.2H4.6Z" />
  </g>,
  'short-sword': <g transform="rotate(45 12 12)">
    <path d="m12 4 1.9 2.4v7.8h-3.8V6.4Z" /><path d="M7.5 14.2h9l-.9 1.8H8.4Z" />
    <rect x="11.1" y="16" width="1.8" height="3.6" rx=".4" /><circle cx="12" cy="20.6" r="1.25" />
  </g>,
  'mage-staff': <g transform="rotate(25 12 12)">
    <rect x="11.3" y="9" width="1.4" height="14.5" rx=".7" /><path d="M12 .8 15 5l-3 4.2L9 5Z" />
    <path {...line} strokeWidth="1.2" d="M9.6 9.6c-1.6-1-2-3.2-1-5m5.8 5c1.6-1 2-3.2 1-5" />
  </g>,
  'arcane-staff': <g transform="rotate(25 12 12)">
    <rect x="11.3" y="9.5" width="1.4" height="14" rx=".7" /><circle {...line} cx="12" cy="5" r="4" strokeWidth="1.4" />
    <path d="m12 2.4.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8L9.4 5l1.8-.8Z" />
  </g>,
  'cleric-staff': <g transform="rotate(20 12 12)">
    <circle {...line} cx="12" cy="4.4" r="3.7" strokeWidth=".9" opacity=".6" />
    <rect x="10.9" y=".8" width="2.2" height="9.6" rx=".6" /><rect x="8" y="3.2" width="8" height="2.2" rx=".6" />
    <rect x="11.3" y="10" width="1.4" height="13.5" rx=".7" />
  </g>,
  'summoner-tome': <g transform="rotate(-8 12 12)">
    <path fillRule="evenodd" d="M5 3.5C5 2.7 5.7 2 6.5 2h12c.8 0 1.5.7 1.5 1.5V19c0 .8-.7 1.5-1.5 1.5h-12C5.7 20.5 5 19.8 5 19ZM12.5 7a4.5 4.5 0 1 0 0 9 4.5 4.5 0 1 0 0-9Zm0 1.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 1 1 0-6.6Zm0 .7.62 1.75 1.85.05-1.47 1.12.53 1.78-1.53-1.05-1.53 1.05.53-1.78-1.47-1.12 1.85-.05Z" />
    <path d="M6.5 20.5h12V22h-12Z" opacity=".55" />
  </g>,
}

/** A weapon icon in its family color. */
export function WeaponGlyph({ weapon, size = 16, tone = true }: { weapon: RpgWeapon; size?: number; tone?: boolean }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden className="shrink-0"
    style={tone ? { color: WEAPON_TONE[weapon] } : undefined}>{WEAPON_ART[weapon]}</svg>
}

/** Weapons side by side, main hand first: two icons for a dual wielder or a Brawler's pair. */
export function WeaponPair({ weapons, size = 16, className = '' }: { weapons: readonly RpgWeapon[]; size?: number; className?: string }) {
  return <span className={`inline-flex items-center gap-0.5 ${className}`}>{weapons.map((w) => <WeaponGlyph key={w} weapon={w} size={size} />)}</span>
}

export function IdentityGlyph({ weapon, element }: { weapon?: RpgWeapon; element?: RpgElement | 'ultima' }) {
  if (weapon) return <WeaponGlyph weapon={weapon} />
  const path = element === 'ultima' ? 'M10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5Z'
    : element === 'fire' ? 'M10 2c1 4-3 5-1 8 1-2 3-2 4-5 6 7 1 13-3 13S2 15 5 10c0 3 2 3 2 3-2-4 0-7 3-11Z'
    : element === 'ice' ? 'M10 1v18M2 5l16 10M18 5 2 15M7 3l3 3 3-3M7 17l3-3 3 3'
    : element === 'lightning' ? 'm11 1-7 10h6l-1 8 7-11h-6l1-7Z'
    : element === 'light' ? 'M10 3v14M3 10h14M5 5l10 10M15 5 5 15M10 1v1m0 16v1M1 10h1m16 0h1'
    : 'M15 2a8 8 0 1 0 3 13A8 8 0 0 1 15 2Z'
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>
}

export function RpgPortrait({ content, outfitId, name, weapons, className = '', compact = false, artwork = 'bust' }: {
  content: LoadedContent | null
  outfitId: string
  name: string
  /** Her equipped weapons, main hand first; empty when she is not enrolled. */
  weapons: readonly RpgWeapon[]
  className?: string
  compact?: boolean
  artwork?: 'bust' | 'icon'
}) {
  const bust = useArt(artwork === 'bust' ? content : null, 'bust', outfitId)
  const asset = content ? getContentAsset(content, 'uma-icons', outfitId) : null
  const label = weapons.length ? weapons.map((w) => RPG_WEAPON_LABELS[w]).join(' + ') : 'Not enrolled'
  return <div className={`relative isolate overflow-hidden rounded-md border border-hairline bg-sunken ${className}`}>
    <div className="absolute inset-0">
      {artwork === 'bust' && bust ? <img src={bust} alt="" draggable={false} className="h-full w-full object-cover object-top" />
        : <AtlasSprite asset={asset} alt="" decorative className="h-full w-full object-cover" fallback={compact
          ? <span className="flex h-full items-center justify-center bg-stage-soft text-[18px] text-ink-on-dark-soft" aria-label="Portrait unavailable">{name.slice(0, 1)}</span>
          : <Placeholder label="Portrait unavailable" />} />}
    </div>
    {compact ? weapons.length > 0 && <div role="img" className="absolute inset-x-0 bottom-0 flex justify-center bg-stage/90 py-0.5" aria-label={`${name}, ${label}`}>
      <WeaponPair weapons={weapons} size={18} />
    </div> : <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-stage via-stage/90 to-transparent px-2 pb-2 pt-8 text-ink-on-dark">
      <span className="block truncate text-[12px] font-semibold" title={name}>{name}</span>
      <span className="mt-1 flex flex-wrap gap-1">{weapons.length ? weapons.map((w) =>
        <span key={w} className="inline-flex min-h-6 items-center gap-0.5 rounded-xs bg-white/15 px-1 text-[10px] leading-3"><WeaponGlyph weapon={w} />{RPG_WEAPON_LABELS[w]}</span>)
        : <span className="inline-flex min-h-6 items-center rounded-xs bg-white/15 px-1 text-[10px] leading-3">Not enrolled</span>}</span>
    </div>}
  </div>
}
