// Original code-native Farm district and food silhouettes (T122); private/source-game art never enters this module.
import type { ReactNode } from 'react'
import type { FarmDistrict, FarmFood } from '@racer/domain/farm/kitchen'
import { TypeIcon } from '../TypeIcon'

const RAW_SHAPE: Record<string, ReactNode> = {
  vegetable: <path d="M24 13c-8 0-13 7-11 15 2 9 7 13 11 13s9-4 11-13c2-8-3-15-11-15Zm0 0c-1-5 1-8 5-10M24 13c-5-4-9-4-12-1" />,
  fruit: <path d="M24 12c-9 0-14 7-12 16 2 8 7 12 12 12s10-4 12-12c2-9-3-16-12-16Zm0 0c0-5 3-8 7-9M24 11c-4-4-8-4-11-1" />,
  milk: <path d="M18 8h12l-1 7 5 6v19H14V21l5-6-1-7Zm1 8h10M14 23h20" />,
  egg: <path d="M24 6c-7 0-13 16-13 24 0 7 6 12 13 12s13-5 13-12C37 22 31 6 24 6Z" />,
  chicken: <path d="M13 29c0-8 6-15 14-15 7 0 12 5 12 12 0 9-8 15-18 15H9v-7l4-5Zm18-15 2-6 5 4" />,
  beef: <path d="M9 27c0-9 8-16 18-16 8 0 13 5 13 12 0 10-9 18-21 18-6 0-10-5-10-14Zm19-7c-4 0-7 3-7 7s3 7 7 7" />,
  pork: <path d="M10 26c0-9 7-16 17-16 8 0 14 6 14 14 0 10-9 17-21 17-6 0-10-6-10-15Zm23-8 7-6M31 16l3-8" />,
}
const PROCESS_SHAPE: Record<string, ReactNode> = {
  'canned-vegetable': <><rect x="12" y="9" width="24" height="31" rx="5" /><path d="M12 17h24M12 33h24M20 25h8" /></>,
  'vegetable-juice': <><path d="M15 13h18l3 27H12l3-27Zm2-5h14" /><path d="m29 14 6-9" /></>,
  'canned-fruit': <><rect x="10" y="10" width="28" height="29" rx="8" /><path d="M10 18h28M10 32h28M24 22v6m-3-3h6" /></>,
  'fruit-juice': <><path d="M14 15h20l2 25H12l2-25Zm2-7h16" /><circle cx="24" cy="27" r="5" /></>,
  cheese: <><path d="M7 23 29 9l13 12-2 19H8L7 23Z" /><circle cx="25" cy="21" r="2" /><circle cx="17" cy="31" r="2" /></>,
  mayonnaise: <><path d="M15 13h18l3 27H12l3-27Z" /><path d="M17 8h14v5M18 27c4-6 8-6 12 0" /></>,
  'chicken-stock': <><path d="M10 15h28l-3 25H13l-3-25Z" /><path d="M15 10h18M18 27h12" /></>,
  'beef-stock': <><path d="M9 17h30l-5 23H14L9 17Z" /><path d="M15 10h18l3 7M18 28h12" /></>,
  'cured-ham': <><path d="M13 35c0-10 8-22 18-22 7 0 11 5 9 12-2 10-11 17-20 17-4 0-7-3-7-7Z" /><circle cx="31" cy="23" r="4" /></>,
}

function DistrictGlyph({ district }: { district: FarmDistrict }) {
  const shape = district === 'garden' ? <path d="M9 38c4-13 12-20 24-24M14 27c-7 0-10-4-9-10 7 0 12 4 12 10m7-5c0-8 5-13 13-13 1 8-4 13-13 13" />
    : district === 'orchard' ? <path d="M24 41V20m0 7c-8 0-13-5-13-12 8 0 13 5 13 12m0-7c0-8 5-13 13-13 0 8-5 13-13 13M14 41h20" />
      : district === 'barn' ? <path d="m7 21 17-13 17 13v20H7V21Zm11 20V27h12v14M7 21h34" />
        : district === 'workshop' ? <path d="M8 40V17l11 7V14l11 7V9h10v31H8Zm6-7h5m6 0h5" />
          : <path d="M10 21h28v19H10V21Zm5-12v12m9-12v12m9-12v12M7 16h34" />
  return <svg viewBox="0 0 48 48" aria-hidden className="h-full w-full fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{shape}</svg>
}

export function FarmDistrictSign({ district, size = 44 }: { district: FarmDistrict; size?: number }) {
  return <span style={{ width: size, height: size }} className="inline-flex shrink-0 rounded-md border border-hairline bg-sunken p-2 text-accent-strong"><DistrictGlyph district={district} /></span>
}

function MealGlyph({ signature }: { signature: string }) {
  const sun = signature === 'sun', pair = signature.includes('-')
  return <svg viewBox="0 0 48 48" aria-hidden className="h-full w-full fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {sun ? <><circle cx="24" cy="22" r="11" /><path d="M24 5v5M8 22H3m42 0h-5M12 10l4 4m20-4-4 4M10 39h28M14 34h20" /></>
      : pair ? <><path d="M6 25h36c0 10-7 16-18 16S6 35 6 25Z" /><path d="M12 25c2-8 8-13 12-13s10 5 12 13M18 12l6-6 6 6" /></>
        : <><path d="M7 24h34c0 11-7 17-17 17S7 35 7 24Z" /><path d="M13 24c2-7 6-11 11-11s9 4 11 11M24 13V6" /></>}
  </svg>
}

export function FarmFoodMark({ food, size = 48 }: { food: FarmFood; size?: number }) {
  const shape = food.stage === 'raw' ? RAW_SHAPE[food.family] : food.stage === 'processed' ? PROCESS_SHAPE[food.family] : null
  return <span style={{ width: size, height: size }} className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-hairline bg-panel p-1.5 text-ink-soft shadow-1">
    {food.stage === 'meal' ? <MealGlyph signature={food.signature ?? 'sun'} /> : food.stage === 'energy'
      ? <svg viewBox="0 0 48 48" aria-hidden className="h-full w-full fill-none stroke-accent-strong" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m28 4-17 24h12l-3 16 17-25H25l3-15Z" /></svg>
      : <svg viewBox="0 0 48 48" aria-hidden className="h-full w-full fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{shape}</svg>}
    {food.stat && <span className="absolute -right-1 -bottom-1"><TypeIcon type={food.stat} size={20} title={`${food.stat} ingredient`} /></span>}
    {food.block && <span className="absolute -top-1 -left-1 rounded-full border border-hairline bg-panel px-1 text-[9px] font-bold text-ink">B{food.block}</span>}
  </span>
}
