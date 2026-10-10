// Farm picker/confirmation boundary (farm-kitchen-rework.md §9). Isolate the whole sheet, including Close.
import type { ReactNode } from 'react'
import { BottomSheet } from '../BottomSheet'
import { RpgModalFocus } from '../rpg/RpgModalFocus'

export function FarmKitchenSheet({ open, close, children }: { open: boolean; close(): void; children: ReactNode }) {
  // Putting the focus boundary inside BottomSheet makes its header/Close and backdrop inert siblings.
  return open ? <RpgModalFocus onClose={close}><BottomSheet open onClose={close} label="Farm details">{children}</BottomSheet></RpgModalFocus> : null
}
