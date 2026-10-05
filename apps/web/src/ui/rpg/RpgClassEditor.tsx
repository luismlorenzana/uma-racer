// Free fresh-profile class correction; accepted save state remains authoritative (docs/design/uma-rpg.md, D259).
import { RPG_CLASS_EDIT_MAX_LEVEL, STRATEGIES, canChangeRpgClass, rpgWeaponsForStyle, type RpgProfile, type RpgWeapon, type Strategy } from '@racer/domain'
import { useState } from 'react'
import { Button } from '../Button'
import { Panel } from '../Panel'
import { RpgModalFocus } from './RpgModalFocus'
import { RPG_ELEMENT_LABELS, RPG_WEAPON_LABELS } from './RpgPortrait'

const styleName = (style: Strategy) => ({ front: 'Front', pace: 'Pace', late: 'Late', end: 'End' })[style]
export function RpgClassEditor({ profile, blocked, onChange }: {
  profile: RpgProfile; blocked: string | null; onChange: (style: Strategy, weapon: RpgWeapon) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(profile.style)
  const [weapon, setWeapon] = useState(profile.weapon)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editable = canChangeRpgClass(profile)
  const styles = STRATEGIES.filter(s => profile.sourceAptitudes.strategy[s] === 'A')
  const weapons = rpgWeaponsForStyle(style)
  const disabled = busy || Boolean(blocked) || !editable
  const close = () => { if (!busy) setOpen(false) }
  const save = async () => {
    if (disabled || style === profile.style && weapon === profile.weapon) return
    setBusy(true); setError('')
    try { await onChange(style, weapon); setOpen(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <>
    <Panel><div className="flex items-center justify-between gap-2"><p className="text-micro">{editable ? 'Class identity' : 'Locked class identity'}</p>
      {editable && <Button variant="secondary" disabled={disabled} onClick={() => {
        setStyle(profile.style); setWeapon(profile.weapon); setError(''); setOpen(true)
      }}>Edit class</Button>}</div>
      <p className="mt-1 text-[15px] font-semibold">{styleName(profile.style)} · {RPG_WEAPON_LABELS[profile.weapon]}</p>
      <p className="mt-1 text-[12px] text-ink-soft">Default signature: {RPG_ELEMENT_LABELS[profile.defaultSignature]} · frozen from content {profile.sourceContentVersion}</p>
      <p className="mt-2 text-[11px] text-ink-faint">{editable ? `Free class changes while Tier 1, RPG Lv${RPG_CLASS_EDIT_MAX_LEVEL}. EXP and stats are kept. From Lv${RPG_CLASS_EDIT_MAX_LEVEL + 1} the class and weapon stay locked, including after promotion.`
        : 'Style and weapon stay locked across presets and promotions.'} A preset may choose another eligible signature.</p>
    </Panel>
    {open && <RpgModalFocus onClose={close}><div className="fixed inset-0 z-50 flex items-end bg-black/60"><div role="dialog" aria-modal="true" aria-label="Edit RPG class" aria-busy={busy}
      className="max-h-[90dvh] w-full overflow-y-auto rounded-t-lg bg-panel p-4 pb-safe text-ink">
      <h3 className="text-xl">Edit RPG class</h3><p className="mt-2 text-xs leading-5 text-ink-soft">Choose from this outfit's frozen A running styles. This is free: your {profile.exp} EXP, stats, affinities and party slots stay unchanged.</p>
      <label className="mt-3 block text-xs font-semibold">A running-style class<select disabled={disabled} value={style} className="mt-1 min-h-11 w-full rounded-sm border border-hairline bg-panel px-3 text-sm"
        onChange={event => { const next = event.target.value as Strategy; setStyle(next); setWeapon(rpgWeaponsForStyle(next)[0]!) }}>
        {styles.map(s => <option key={s} value={s}>{styleName(s)}</option>)}
      </select></label>
      <label className="mt-3 block text-xs font-semibold">Weapon path<select disabled={disabled} value={weapon} className="mt-1 min-h-11 w-full rounded-sm border border-hairline bg-panel px-3 text-sm"
        onChange={event => setWeapon(event.target.value as RpgWeapon)}>{weapons.map(w => <option key={w} value={w}>{RPG_WEAPON_LABELS[w]}</option>)}</select></label>
      <p className="mt-3 text-xs">{styleName(profile.style)} · {RPG_WEAPON_LABELS[profile.weapon]} → {styleName(style)} · {RPG_WEAPON_LABELS[weapon]}</p>
      <p className="mt-2 text-xs text-ink-soft">The new class appears only after your account acknowledges the change.</p>
      {blocked && <p role="status" className="mt-2 text-xs">{blocked}</p>}
      {!editable && <p role="status" className="mt-2 text-xs">This outfit is no longer eligible for a class change.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-4 flex gap-2"><Button variant="secondary" disabled={busy} className="flex-1" onClick={close}>Cancel</Button>
        <Button disabled={disabled || style === profile.style && weapon === profile.weapon} className="flex-1" onClick={() => void save()}>{busy ? 'Saving…' : 'Save class'}</Button></div>
    </div></div></RpgModalFocus>}
  </>
}
