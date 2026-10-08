// DEV-only original vector legibility proof, no account or content I/O (T114).
import { STRATEGIES } from '@racer/domain'
import { ConstellationTicketIcon, TICKET_STYLE_NAME } from '../../ui/ConstellationTicketIcon'
import { InspirationTokenIcon } from '../../ui/InspirationTokenIcon'
import { TicketIcon, LevelUpIcon } from '../../ui/icons'
export function PuzzleMaterialIconProofScreen() {
  return <main className="min-h-dvh bg-stage p-3 pb-safe pt-safe text-ink-on-dark"><h1 className="py-3 font-display text-lg">Original ticket vectors</h1><p className="text-xs">DEV only · no account, art pack or grant. Strategy position glyphs, not combat elements.</p>
    {(['dark', 'light', 'grayscale'] as const).map(theme => <section key={theme} aria-label={`${theme} ticket proof`} className={`mt-3 rounded-md p-3 ${theme === 'light' ? 'bg-white text-slate-900' : 'bg-stage-soft'} ${theme === 'grayscale' ? 'grayscale' : ''}`}><h2 className="mb-2 text-sm capitalize">{theme}</h2>
      <div className="grid grid-cols-4 gap-2">{STRATEGIES.map(style => <div key={style} className="grid justify-items-center gap-2 text-xs"><span>{TICKET_STYLE_NAME[style]}</span><ConstellationTicketIcon style={style} size={24} /><ConstellationTicketIcon style={style} tier={1} size={32} /><ConstellationTicketIcon style={style} tier={2} size={48} /></div>)}</div>
    </section>)}
    <section className="mt-3 flex items-center justify-around rounded-md border border-hairline-dark p-3 text-center text-xs"><div><TicketIcon size={32} />Daily Training Ticket</div><div><LevelUpIcon size={32} />Legacy Universal CL</div><div><InspirationTokenIcon kind="slot" size={32} />Inspiration Slot</div></section>
  </main>
}
