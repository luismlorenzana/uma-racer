import { m, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'go' | 'secondary'

const FACE: Record<Variant, string> = {
  primary: 'bg-gradient-to-b from-[#ffd65a] to-gold-deep text-white text-outline border-[#fff1b8]',
  go: 'bg-gradient-to-b from-[#6fdc7d] to-turf-deep text-white text-outline border-[#c9f5cf]',
  secondary: 'bg-gradient-to-b from-white to-[#eef3fa] text-ink border-white',
}

const EDGE: Record<Variant, string> = {
  primary: '#b47a06',
  go: '#23702f',
  secondary: '#c5cfdd',
}

/**
 * Chunky game button: a darker bottom edge that compresses on press, springing back on release
 * (docs/design/ux.md#visual-direction-racecourse-pop).
 */
export function GameButton({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...rest
}: { variant?: Variant; size?: 'md' | 'lg'; children: ReactNode } & HTMLMotionProps<'button'>) {
  const edge = EDGE[variant]
  return (
    <m.button
      type="button"
      disabled={disabled}
      initial={false}
      animate={{ y: 0, boxShadow: `0 6px 0 ${edge}, 0 10px 18px rgb(0 0 0 / 0.14)` }}
      whileTap={disabled ? undefined : { y: 5, scale: 0.98, boxShadow: `0 1px 0 ${edge}, 0 3px 6px rgb(0 0 0 / 0.12)` }}
      transition={{ type: 'spring', stiffness: 700, damping: 30 }}
      className={`relative rounded-2xl border-2 font-extrabold tracking-wide disabled:opacity-50 ${FACE[variant]} ${
        size === 'lg' ? 'min-h-16 px-6 text-xl' : 'min-h-12 px-4 text-base'
      } ${className}`}
      {...rest}
    >
      {children}
    </m.button>
  )
}
