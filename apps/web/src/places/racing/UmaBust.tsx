// Racer-only sizing for the kit's bust: the kit owns the image and provider, the race owns its layout (SB6).
import { UmaBust as KitUmaBust } from '@luismlorenzana/uma-kit/album'

export function UmaBust({ outfitId, size }: { outfitId: string; size: number }) {
  return <span aria-hidden className="block shrink-0 overflow-hidden rounded-sm" style={{ width: size, height: size }}>
    <KitUmaBust outfitId={outfitId} label="" size={size} className="size-full" />
  </span>
}
