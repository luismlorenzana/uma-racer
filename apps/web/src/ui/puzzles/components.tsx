// Compact campaign primitives on the shared dark shell (docs/design/uma-puzzles.md §9).
import type { PuzzleOutfitSaveV1, Strategy } from '@racer/domain'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { getContentAsset, type LoadedContent } from '../../content/runtime'
import { AtlasSprite } from '../AtlasSprite'
import { Button } from '../Button'
import { CrownIcon, StableIcon } from '../icons'
import { ConstellationTicketIcon, TICKET_STYLE_NAME } from '../ConstellationTicketIcon'
import { RpgModalFocus } from '../rpg/RpgModalFocus'
import { PuzzleElementMark } from './ElementMark'
export const PUZZLE_STYLE_LABEL = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' } as const
export function PuzzleCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-hairline-dark bg-stage-soft p-3 ${className}`}>{children}</div>
}
export function PuzzleButton({ children, secondary = false, ...props }: Omit<Parameters<typeof Button>[0], 'variant'> & { secondary?: boolean }) {
  return <Button {...props} size="sm" variant={secondary ? 'secondary' : 'primary'} className={`${secondary ? '!border-hairline-dark !bg-stage-soft !text-ink-on-dark' : ''} ${props.className ?? ''}`}>{children}</Button>
}
export function PuzzleSelect<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void; disabled?: boolean }) {
  return <label className="block text-xs text-ink-on-dark-soft">{label}<select value={value} onChange={e => onChange(e.target.value as T)} disabled={disabled}
    className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage px-2 text-sm text-ink-on-dark disabled:opacity-45">
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select></label>
}
export function PuzzleTabs({ root }: { root: string }) {
  return <nav aria-label="Puzzle sections" className="mb-3 flex gap-1 overflow-x-auto rounded-sm bg-stage-soft p-1">
    {['Parties', 'Roster', 'Chapters', 'Exchange', 'Items'].map((label, i) => <NavLink key={label} end={i === 0} to={i === 0 ? root : `${root}/${label.toLowerCase()}`}
      className={({ isActive }) => `flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xs px-2 text-xs font-semibold ${isActive ? 'bg-accent text-ink' : 'text-ink-on-dark-soft'}`}>{label}</NavLink>)}
  </nav>
}
export function PuzzleOutfitIcon({ id, name, content, outfit, leader = false }: { id: string; name: string; content: LoadedContent; outfit?: PuzzleOutfitSaveV1 | null; leader?: boolean }) {
  return <div className="relative aspect-square overflow-hidden rounded-md border border-hairline-dark bg-stage">
    <AtlasSprite asset={getContentAsset(content, 'uma-icons', id)} alt={name} fallback={<span className="flex h-full items-center justify-center text-accent"><StableIcon size={32} /></span>} />
    {outfit && <><span className="absolute right-0 top-0 rounded-bl-sm bg-stage/95 p-0.5"><PuzzleElementMark element={outfit.enrollment.element} /></span>
      <span className="absolute bottom-0 right-0 rounded-tl-sm bg-stage/95 px-1 text-[10px] font-semibold">PL {outfit.enrollment.level}</span></>}
    {leader && <span className="absolute left-0 top-0 rounded-br-sm bg-stage/95 p-0.5" aria-label="Leader"><CrownIcon size={16} /></span>}
  </div>
}
export function PuzzleMaterialMark({ style, quantity, tier, size = 32 }: { style: Strategy; quantity?: number; tier?: number; size?: number }) {
  return <span className="inline-flex items-center gap-0.5 text-xs text-accent" aria-label={`${quantity ?? ''} ${PUZZLE_STYLE_LABEL[style]} constellation tickets`}>
    <ConstellationTicketIcon style={style} tier={tier} size={size} /><span>{TICKET_STYLE_NAME[style]}{quantity !== undefined && ` ×${quantity}`}</span>
  </span>
}
export function PuzzleModal({ title, onClose, children, footer }: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode }) {
  return <RpgModalFocus onClose={onClose}><div className="fixed inset-0 z-40 flex items-end justify-center bg-stage/80" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-lg border border-hairline-dark bg-stage-soft text-ink-on-dark" onClick={e => e.stopPropagation()}>
      <header className="flex shrink-0 items-center gap-2 border-b border-hairline-dark px-4 py-2"><h2 className="min-w-0 flex-1 text-lg">{title}</h2><PuzzleButton secondary onClick={onClose}>Close</PuzzleButton></header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-safe">{children}</div>
      {footer && <div className="shrink-0 border-t border-hairline-dark p-3 pb-safe">{footer}</div>}
    </section>
  </div></RpgModalFocus>
}
