// Each Hub page's palette (docs/game/11-hub-and-places.md §10, §12; uma-rpg's `PALETTES` in `hub/scene/HubScene.ts`):
// the canvas background, the code-drawn ground and features the scene falls back to when the atlases can't load, and the
// colours a placeholder building is drawn in until uma-art draws it (§10.3). Phaser-free, so the DOM's building art
// (`ui/BuildingSprite.tsx`) draws the same placeholders.
import type { HubPage } from '@racer/domain/hub'

export interface Palette {
  /** Behind the map, and what a page fades through. */
  readonly background: string
  /** Fallback ground tones, chosen per 24 px cell. */
  readonly ground: readonly number[]
  /** Fallback roads and features. */
  readonly feature: number
  /** A placeholder building's walls, roof and trim. */
  readonly building: { readonly wall: number; readonly roof: number; readonly trim: number }
}

export const PALETTES: Readonly<Record<HubPage, Palette>> = {
  // uma-rpg's Town: warm earth, plaster and terracotta.
  town: {
    background: '#3e3026',
    ground: [0x5a4636, 0x614b3a, 0x553f31, 0x5d4838],
    feature: 0x76604a,
    building: { wall: 0xe0d2b4, roof: 0x8a4a32, trim: 0xe0b25c },
  },
  // uma-rpg's Learning District: dusk stone and slate.
  training: {
    background: '#2c2c3a',
    ground: [0x3f3f52, 0x45455a, 0x3b3b4d, 0x42425a],
    feature: 0x56546e,
    building: { wall: 0xb8664a, roof: 0x4a4a78, trim: 0xa99be0 },
  },
  // The Racing page: mown turf, a dirt track, white rails, racing green and gold (A01's colours).
  racing: {
    background: '#22401f',
    ground: [0x4c8a3c, 0x52923f, 0x478238, 0x4f8e3d],
    feature: 0x9a7650,
    building: { wall: 0xf0ece0, roof: 0x2e6b3a, trim: 0xd6a23e },
  },
  // uma-rpg's Farmlands: grass and field browns.
  farm: {
    background: '#2c4a28',
    ground: [0x3f6b3a, 0x44723e, 0x3b6536, 0x416e3b],
    feature: 0x7a6444,
    building: { wall: 0xcfb894, roof: 0xb4482e, trim: 0x7cc46a },
  },
}
