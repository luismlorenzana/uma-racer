// Keyboard/VoiceOver modal isolation for RPG checkpoint dialogs (docs/design/uma-rpg.md#phone-presentation).
import { useEffect, useRef, type ReactNode } from 'react'
export function RpgModalFocus({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings: HTMLElement[] = []
    let branch: HTMLElement | null = wrapper.current
    while (branch?.parentElement && branch !== document.body) {
      siblings.push(...[...branch.parentElement.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c !== branch))
      branch = branch.parentElement
    }
    const before = siblings.map((c) => c.inert)
    siblings.forEach((c) => { c.inert = true })
    wrapper.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { siblings.forEach((c, i) => { c.inert = before[i]! }); previous?.focus() }
  }, [])
  return <div ref={wrapper} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close.current() }
    if (event.key !== 'Tab') return
    const controls = [...wrapper.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')]
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
  }}>{children}</div>
}
