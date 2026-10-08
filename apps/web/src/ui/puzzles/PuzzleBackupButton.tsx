// Explicit private download; no import/reset/restore action and no server mutation.
import { useState } from 'react'
export function PuzzleBackupButton({ light = false }: { light?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  return <div className={light ? 'text-ink' : undefined}><button type="button" className="min-h-11 w-full rounded-sm border border-current px-3 text-sm font-semibold disabled:opacity-50" disabled={busy} onClick={() => {
    setBusy(true); setError(null)
    void Promise.all([import('../../game/puzzles/backup'), import('../../game/db')]).then(([{ downloadPuzzleBackup }, { db }]) => downloadPuzzleBackup(db))
      .catch(e => setError(e instanceof Error ? e.message : 'Private backup could not be downloaded')).finally(() => setBusy(false))
  }}>{busy ? 'Preparing private download…' : 'Download pre-Puzzles backup'}</button>
    <p className={`mt-1 text-[10px] ${light ? 'text-ink-soft' : 'text-ink-on-dark-soft'}`}>Private whole-account recovery copy from the preparing device. Keep it private. Never partially restore or clear app data.</p>
    {error && <p role="alert" className="mt-2 text-xs">{error}</p>}
  </div>
}
