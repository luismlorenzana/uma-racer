// A HUD number that moves when it changes (docs/rework/11-hub-and-places.md §2.1): the new value slides in by a CSS
// transform and opacity transition, never a spring (CLAUDE.md "Conventions"). Reduced motion swaps it at once
// (`g2.css`). Tabular figures, so counters don't jitter.
import { useLayoutEffect, useRef, useState } from 'react'

export function AnimatedNumber({ value, format = (n) => n.toLocaleString('en-US'), className = '' }: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const [entering, setEntering] = useState(false)
  const last = useRef(value)
  useLayoutEffect(() => {
    if (last.current === value) return
    last.current = value
    setEntering(true)
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntering(false))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [value])
  return (
    <span className={`g2-number inline-block tabular-nums ${className}`} data-entering={entering ? '' : undefined}>
      {format(value)}
    </span>
  )
}
