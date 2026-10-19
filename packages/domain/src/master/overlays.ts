// Only racer-authored classifications live in its private bucket after SE1. No master rows or art in this document.
export interface RacerOverlays { readonly schema: 1; readonly flair: unknown; readonly cardFocus: unknown }
export interface OverlayIndex { readonly version: string; readonly file: { readonly path: string; readonly bytes: number; readonly sha256: string } }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseRacerOverlays(value: unknown): RacerOverlays {
  if (!record(value) || value.schema !== 1 || !record(value.flair) || !record(value.cardFocus) ||
    Object.keys(value).sort().join(',') !== 'cardFocus,flair,schema') throw new Error('Required racer overlay is missing or malformed')
  return { schema: 1, flair: value.flair, cardFocus: value.cardFocus }
}

export function parseOverlayIndex(value: unknown): OverlayIndex {
  if (!record(value) || typeof value.version !== 'string' || !/^[a-f0-9]{12}$/.test(value.version) || !record(value.file)) throw new Error('Malformed racer overlay index')
  const { path, bytes, sha256 } = value.file
  if (typeof path !== 'string' || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256) ||
    path !== `overlays/racer.${sha256.slice(0, 16)}.json` || value.version !== sha256.slice(0, 12) ||
    !Number.isSafeInteger(bytes) || (bytes as number) < 1 || (bytes as number) > 2_097_152) throw new Error('Malformed racer overlay file')
  return { version: value.version, file: { path, bytes: bytes as number, sha256 } }
}
