// Shared campaign building blocks on the dark stage (docs/design/uma-rpg.md#phone-presentation).
import { rpgTierLevel, type BattleWeaknesses, type BattleWeaponKind, type RpgElement, type RpgWeapon } from '@racer/domain'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { IdentityGlyph, RPG_ELEMENT_LABELS } from './RpgPortrait'

/** Tier 1 reads "Lv 7"; later tiers lead with their tier. */
export function formatRpgLevel(lifetime: number): string {
  const { tier, level } = rpgTierLevel(lifetime)
  return tier === 1 ? `Lv ${level}` : `T${tier} Lv ${level}`
}
export function formatRpgBand(start: number, end: number): string {
  const a = rpgTierLevel(start), b = rpgTierLevel(end)
  return a.tier === b.tier ? `${a.tier === 1 ? '' : `T${a.tier} `}Lv ${a.level}–${b.level}` : `${formatRpgLevel(start)} – ${formatRpgLevel(end)}`
}

export const ELEMENT_TONE: Readonly<Record<RpgElement, string>> = {
  fire: 'text-[#ff8a5c]', ice: 'text-[#8fd3ff]', lightning: 'text-[#ffd84d]', light: 'text-[#fff2b0]', dark: 'text-[#c79bff]',
}
export const ELEMENT_RING: Readonly<Record<RpgElement, string>> = {
  fire: 'ring-[#ff8a5c]', ice: 'ring-[#8fd3ff]', lightning: 'ring-[#ffd84d]', light: 'ring-[#fff2b0]', dark: 'ring-[#c79bff]',
}

export function ElementMark({ element, label = false, className = '' }: { element: RpgElement; label?: boolean; className?: string }) {
  return <span className={`inline-flex items-center gap-0.5 ${ELEMENT_TONE[element]} ${className}`} aria-label={RPG_ELEMENT_LABELS[element]} role="img">
    <IdentityGlyph element={element} />{label && <span className="text-[11px] font-semibold">{RPG_ELEMENT_LABELS[element]}</span>}
  </span>
}

export function RpgCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-hairline-dark bg-stage-soft p-3 ${className}`}>{children}</div>
}

export function RpgTabs() {
  const tabs = [{ to: '/rpg', label: 'Parties', end: true }, { to: '/rpg/roster', label: 'Roster', end: false }]
  return <nav aria-label="RPG sections" className="grid grid-cols-2 gap-1 rounded-sm bg-stage-soft p-1">
    {tabs.map(({ to, label, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) =>
      `flex min-h-11 items-center justify-center rounded-xs text-[13px] font-semibold ${isActive ? 'bg-accent text-ink' : 'text-ink-on-dark-soft'}`}>{label}</NavLink>)}
  </nav>
}

export function RpgSelect<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean
}) {
  return <label className="block text-[11px] font-semibold text-ink-on-dark-soft">{label}
    <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value as T)}
      className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage px-3 text-[14px] text-ink-on-dark disabled:opacity-50">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
}

export function RpgBar({ value, max, tone = 'hp', className = '' }: { value: number; max: number; tone?: 'hp' | 'mp' | 'exp' | 'shield'; className?: string }) {
  const color = tone === 'hp' ? 'bg-[#5fd28a]' : tone === 'mp' ? 'bg-[#6aa8ff]' : tone === 'shield' ? 'bg-[#e0e6ef]' : 'bg-accent'
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return <span className={`block h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`} aria-hidden>
    <span className={`block h-full rounded-full ${color}`} style={{ width: `${width}%`, transition: 'width 240ms ease-out' }} />
  </span>
}

export function PrimaryButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`flex min-h-12 w-full items-center justify-center rounded-sm bg-accent px-4 text-[15px] font-semibold text-ink disabled:opacity-40 ${className}`} {...rest}>{children}</button>
}
export function GhostButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark px-3 text-[13px] font-semibold text-ink-on-dark disabled:opacity-40 ${className}`} {...rest}>{children}</button>
}

export const WEAPON_KIND_LABEL: Readonly<Record<BattleWeaponKind, string>> = {
  greatsword: 'Greatsword', spear: 'Spear', sword: 'Sword', staff: 'Staff', tome: 'Tome',
}
const KIND_GLYPH: Readonly<Record<BattleWeaponKind, RpgWeapon>> = {
  greatsword: 'greatsword', spear: 'spear', sword: 'sword-shield', staff: 'wizard-staff', tome: 'tome',
}
export function WeaponKindMark({ kind, className = '' }: { kind: BattleWeaponKind; className?: string }) {
  return <span role="img" aria-label={WEAPON_KIND_LABEL[kind]} className={`inline-flex items-center ${className}`}><IdentityGlyph weapon={KIND_GLYPH[kind]} /></span>
}

/** Octopath-style break gauge: the shield count, or BREAK while it is down. */
export function ShieldBadge({ value, broken = false, className = '' }: { value: number; broken?: boolean; className?: string }) {
  return <span role="img" aria-label={broken ? 'Broken' : `Shield ${value}`} className={`relative inline-flex h-7 w-6 shrink-0 items-center justify-center ${className}`}>
    <svg viewBox="0 0 24 28" className={`absolute inset-0 h-full w-full ${broken ? 'text-accent' : 'text-[#9fb4cc]'}`} aria-hidden>
      <path d="M12 1 2 5v8c0 7 4.5 11.5 10 14 5.5-2.5 10-7 10-14V5L12 1Z" fill="currentColor" opacity={broken ? 0.9 : 0.35} stroke="currentColor" strokeWidth="1.5" />
    </svg>
    <span className="relative text-[11px] font-bold leading-none">{broken ? '!' : value}</span>
  </span>
}

/** Weakness icons: the element first, then weapon kinds. */
export function WeaknessIcons({ weaknesses, className = '' }: { weaknesses: BattleWeaknesses; className?: string }) {
  return <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`Weak to ${[weaknesses.element, ...weaknesses.weapons.map((w) => WEAPON_KIND_LABEL[w])].join(', ')}`}>
    <ElementMark element={weaknesses.element} />{weaknesses.weapons.map((w) => <WeaponKindMark key={w} kind={w} />)}
  </span>
}
