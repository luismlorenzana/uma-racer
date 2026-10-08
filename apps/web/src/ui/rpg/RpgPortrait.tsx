// Reusable RPG outfit identity for party, map, battle and result (docs/design/uma-rpg.md#phone-presentation).
import type { RpgElement, RpgWeapon } from '@racer/domain'
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

export function IdentityGlyph({ weapon, element }: { weapon?: RpgWeapon; element?: RpgElement | 'ultima' }) {
  const path = weapon === 'greatsword' ? 'M3 17 16 4m-2-2 4 0v4M2 13l5 5m-4 0-1 1'
    : weapon === 'spear' ? 'M3 18 15 4m-1-2 4 0-1 4M7 11l3 3'
    : weapon === 'axe' ? 'M4 18 13 9M10 3c4 0 7 3 7 7l-3 1-5-5 1-3Z'
    : weapon === 'bow' ? 'M4 2c7 1 13 7 14 14M4 2l14 14M2 18l8-8m0 0v3m0-3H7'
    : weapon === 'short-sword' ? 'M5 15 13 7m-2-1 4-1-1 4M4 11l5 5m-4 0-2 2'
    : weapon === 'mage-staff' ? 'M5 18 13 7m1-5 3 3-3 3-3-3 3-3Zm-4 0-1 2m10 4 2 1'
    : weapon === 'arcane-staff' ? 'M5 18 12 9m3-7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 1.5v3m-1.5-1.5h3'
    : weapon === 'cleric-staff' ? 'M5 18 13 5m-4 0h8m-4-4v8m-3 0 3 2 3-2'
    : weapon === 'summoner-tome' ? 'M2 4c3-1 5 0 8 2 3-2 5-3 8-2v12c-3-1-5 0-8 2-3-2-5-3-8-2V4Zm8 2v12'
    : element === 'ultima' ? 'M10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5Z'
    : element === 'fire' ? 'M10 2c1 4-3 5-1 8 1-2 3-2 4-5 6 7 1 13-3 13S2 15 5 10c0 3 2 3 2 3-2-4 0-7 3-11Z'
    : element === 'ice' ? 'M10 1v18M2 5l16 10M18 5 2 15M7 3l3 3 3-3M7 17l3-3 3 3'
    : element === 'lightning' ? 'm11 1-7 10h6l-1 8 7-11h-6l1-7Z'
    : element === 'light' ? 'M10 3v14M3 10h14M5 5l10 10M15 5 5 15M10 1v1m0 16v1M1 10h1m16 0h1'
    : 'M15 2a8 8 0 1 0 3 13A8 8 0 0 1 15 2Z'
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={path} /></svg>
}

export function RpgPortrait({ content, outfitId, name, weapon, element, className = '', compact = false, artwork = 'bust' }: {
  content: LoadedContent | null
  outfitId: string
  name: string
  weapon: RpgWeapon | null
  element: RpgElement | null
  className?: string
  compact?: boolean
  artwork?: 'bust' | 'icon'
}) {
  const bust = useArt(artwork === 'bust' ? content : null, 'bust', outfitId)
  const asset = content ? getContentAsset(content, 'uma-icons', outfitId) : null
  return <div className={`relative isolate overflow-hidden rounded-md border border-hairline bg-sunken ${className}`}>
    <div className="absolute inset-0">
      {artwork === 'bust' && bust ? <img src={bust} alt="" draggable={false} className="h-full w-full object-cover object-top" />
        : <AtlasSprite asset={asset} alt="" decorative className="h-full w-full object-cover" fallback={compact
          ? <span className="flex h-full items-center justify-center bg-stage-soft text-[18px] text-ink-on-dark-soft" aria-label="Portrait unavailable">{name.slice(0, 1)}</span>
          : <Placeholder label="Portrait unavailable" />} />}
    </div>
    {compact ? (weapon || element) && <div role="img" className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-stage/90 py-0.5 text-ink-on-dark" aria-label={`${name}, ${weapon ? RPG_WEAPON_LABELS[weapon] : 'Not enrolled'}, ${element ? RPG_ELEMENT_LABELS[element] : 'no element'}`}>
      {weapon && <IdentityGlyph weapon={weapon} />}{element && <IdentityGlyph element={element} />}
    </div> : <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-stage via-stage/90 to-transparent px-2 pb-2 pt-8 text-ink-on-dark">
      <span className="block truncate text-[12px] font-semibold" title={name}>{name}</span>
      <span className="mt-1 flex flex-wrap gap-1">
        <span className="inline-flex min-h-6 items-center gap-0.5 rounded-xs bg-white/15 px-1 text-[10px] leading-3">
          <IdentityGlyph weapon={weapon ?? undefined} />{weapon ? RPG_WEAPON_LABELS[weapon] : 'Not enrolled'}
        </span>
        {element && <span className="inline-flex min-h-6 items-center gap-0.5 rounded-xs bg-white/15 px-1 text-[10px] leading-3"><IdentityGlyph element={element} />{RPG_ELEMENT_LABELS[element]}</span>}
      </span>
    </div>}
  </div>
}
