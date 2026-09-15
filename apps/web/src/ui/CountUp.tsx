import { animate, useMotionValue, useReducedMotion, useTransform, m } from 'motion/react'
import { useEffect } from 'react'

/** Numbers never jump: counters tick to their new value (docs/research/game-web-tech.md#game-feel-juice-principles-applied-to-ui). */
export function CountUp({ value, duration = 0.6 }: { value: number; duration?: number }) {
  const reduced = useReducedMotion()
  const motionValue = useMotionValue(value)
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration, ease: 'easeOut' })
    return () => controls.stop()
  }, [value, duration, reduced, motionValue])

  return <m.span>{rounded}</m.span>
}
