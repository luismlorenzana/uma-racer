// Battle opens the same campaign guide at its current context (T099).
import { RpgGuide } from './RpgGuide'
export function RpgBattleGuide(props: {
  onClose: () => void; reduced: boolean; setReduced: (value: boolean) => void
  onAbandon: () => void; canAbandon: boolean; proof: boolean
}) {
  return <RpgGuide {...props} startAt="turn" finishLabel="Back to battle" />
}
