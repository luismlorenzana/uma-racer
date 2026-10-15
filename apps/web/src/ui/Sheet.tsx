// Today's BottomSheet through a portal (T138), so a sheet can open from inside another one (a question over a stock or
// quantity sheet) without sitting in that sheet's transformed box. Context (router, game) carries through the portal.
import type { ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { BottomSheet } from '../../ui/BottomSheet'

export function Sheet(props: ComponentProps<typeof BottomSheet>) {
  if (typeof document === 'undefined') return null
  return createPortal(<BottomSheet {...props} />, document.body)
}
