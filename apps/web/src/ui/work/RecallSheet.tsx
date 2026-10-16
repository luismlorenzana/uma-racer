// Recall (docs/game/07-farm.md §2, §5; docs/game/05-training-hub.md §2; T140): before it confirms, a preview from
// `recall` run on the current state, so it says exactly what the real one does: the outputs it pays, the inputs that
// come back ("8 Chopped Carrot and 2 Wheat Flour come back"), the minutes of progress lost and the queue dropped. Then
// `recall`. A slot row opens it from its ⋯ sheet (D366); `RecallPreviewLines` is the preview alone.
import { BottomSheet } from '@luismlorenzana/uma-kit/ui'
import { useGame } from '../../app/game'
import { recallPreview, type RecallPreview } from './model'
import { TapNoteLine } from './TapNote'
import { useTap } from './useTap'
import { useWorkView } from './view'
import { itemsList, workWords } from './words'

/** The preview's lines, in order: paid, returned, lost, dropped; "Nothing is lost." when no time or queue goes. */
export function recallLines(preview: RecallPreview): string[] {
  const lines: string[] = []
  const paid = [itemsList(preview.paid), preview.unlocks > 0 ? workWords(preview.unlocks === 1 ? 'what-session-one' : 'what-session', { n: preview.unlocks }) : '']
    .filter((part) => part !== '')
  if (paid.length > 0) lines.push(workWords('recall-paid', { items: paid.join(' and ') }))
  if (preview.returned.length > 0) {
    const one = preview.returned.length === 1 && preview.returned[0]!.qty === 1
    lines.push(workWords(one ? 'recall-returned-one' : 'recall-returned', { items: itemsList(preview.returned) }))
  }
  if (preview.lostMinutes > 0) lines.push(preview.lostMinutes === 1 ? workWords('recall-lost-one') : workWords('recall-lost', { n: preview.lostMinutes }))
  if (preview.droppedQueue > 0) lines.push(preview.droppedQueue === 1 ? workWords('recall-queue-one') : workWords('recall-queue', { n: preview.droppedQueue }))
  if (preview.lostMinutes === 0 && preview.droppedQueue === 0) lines.push(workWords('recall-nothing'))
  return lines
}

export function RecallPreviewLines({ outfitId }: { outfitId: string }) {
  const view = useWorkView()
  if (view === null) return null
  const preview = recallPreview(view.settled, outfitId, view.now, view.env)
  return (
    <ul data-g2="recall-preview" className="space-y-1 text-[14px] text-ink">
      {recallLines(preview).map((line) => <li key={line}>{line}</li>)}
    </ul>
  )
}

export function RecallSheet({ outfitId, open, onClose }: { outfitId: string; open: boolean; onClose: () => void }) {
  const tap = useTap()
  const name = useGame((snapshot) => snapshot.env?.content.umas.get(outfitId)?.name ?? '')
  const title = workWords('recall-title', { uma: name })
  const confirm = async () => {
    const answer = await tap.run('recall', { outfitId }, `recall:${outfitId}`)
    if (answer?.kind === 'done') onClose()
  }
  return (
    <BottomSheet open={open} onClose={onClose} label={title}>
      <div data-g2="recall-sheet" className="space-y-3 pb-2">
        <h2 className="text-lg">{title}</h2>
        {open && <RecallPreviewLines outfitId={outfitId} />}
        <TapNoteLine tap={tap} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={tap.pending !== null}
            className="font-display min-h-12 flex-1 rounded-sm border border-danger/40 bg-panel font-semibold text-danger shadow-1 disabled:opacity-45"
          >
            {workWords('recall-confirm')}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-sm font-semibold text-ink-soft">{workWords('not-now')}</button>
        </div>
      </div>
    </BottomSheet>
  )
}
