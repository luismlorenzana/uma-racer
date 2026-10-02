// Reuses the existing minigame tutorial model without inheriting ticket/reward rules (docs/design/minigame-kit.md).
import { useEffect, useRef } from 'react'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'

export function RpgBattleGuide({ onClose, reduced, setReduced, onAbandon, canAbandon, proof }: {
  onClose: () => void; reduced: boolean; setReduced: (value: boolean) => void; onAbandon: () => void; canAbandon: boolean; proof: boolean
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = [...wrapper.current?.parentElement?.children ?? []].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== wrapper.current)
    const before = siblings.map((child) => child.inert)
    siblings.forEach((child) => { child.inert = true })
    wrapper.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { siblings.forEach((child, index) => { child.inert = before[index]! }); previous?.focus() }
  }, [])
  const pages: PagedGuidePage<string>[] = [
    { id: 'turn', title: 'Five outfits, one team', body: <>
      <p className="text-[15px] leading-6">Choose a ready outfit, Attack / Skill / Guard, then a legal target. Review the projected effect and confirm. Each living outfit acts once; the final action also resolves the enemy intents.</p>
      <p className="rounded-md border border-hairline-dark bg-stage-soft p-3 text-sm">HP and MP are beside each portrait. Weapon and signature-element glyphs stay over the portrait; their text labels stay beside it.</p>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduced motion / immediate cues</label>
    </> },
    { id: 'channels', title: 'Physical or magical', body: <>
      <p>Greatsword, spear and sword + shield use physical damage. Staves and tomes use magical damage.</p>
      <p>Physical skills add an elemental rider; only that rider uses the matchup. Magical skills apply the matchup to their full damage. The Details sheet shows the exact engine projection, including the enemy round when your last outfit acts.</p>
    </> },
    { id: 'elements', title: 'Find the weakness', body: <>
      <p className="rounded-md border border-hairline-dark bg-stage-soft p-4 text-lg leading-8">Fire beats Ice<br />Ice beats Lightning<br />Lightning beats Fire</p>
      <p>Light and Dark beat each other and are neutral to the triangle. The preview says Weakness, Resistance or Neutral; color is never the only clue.</p>
    </> },
    { id: 'support', title: 'Plan, guard and heal', body: <>
      <p>Use Plans to read every enemy's next action, channel, element and target. Phase changes reveal new intents before the next resolution.</p>
      <p>Guard intercepts one hit for the ally you select. Healing and support target living allies; KO outfits cannot act. Only equipped, learned skills with enough MP are enabled.</p>
    </> },
    { id: 'save', title: 'Your turn stays saved', body: <>
      <p>Back or refresh keeps the exact saved action. Skip changes only animation. Missing journals and another device require explicit same-seed recovery; no friendlier enemy kit is generated.</p>
      <p>Pending results are not yet earned. EXP, Items and the next map node cannot be spent or advanced until acknowledgement.</p>
      {proof && <p>This development proof never awards account progress.</p>}
      <button disabled={!canAbandon} className="min-h-11 rounded-sm border border-hairline-dark p-3 text-sm disabled:opacity-40" onClick={onAbandon}>Abandon to checkpoint · no rewards</button>
    </> },
  ]
  return <div ref={wrapper} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    if (event.key !== 'Tab') return
    const controls = [...wrapper.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input')]
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
  }}><PagedGuide open pages={pages} startAt="turn" titleId="rpg-battle-guide-title" finishLabel="Back to battle" onClose={onClose} /></div>
}
