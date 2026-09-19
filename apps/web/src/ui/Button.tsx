import { m, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'

const FACE: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-strong hover:text-ink-on-dark',
  secondary: 'bg-panel text-ink border border-hairline-strong',
  tertiary: 'bg-transparent text-ink-soft',
  destructive: 'bg-panel text-danger border border-danger/40',
}

const SIZE = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-12 px-4 text-[15px]',
  lg: 'min-h-14 px-5 text-lg',
} as const

/**
 * The one button. Fill plus a 0.98 press, never a plastic slab
 * (docs/design/visual-system.md#components).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...rest
}: { variant?: ButtonVariant; size?: keyof typeof SIZE; children: ReactNode } & HTMLMotionProps<'button'>) {
  return (
    <m.button
      type="button"
      disabled={disabled}
      initial={false}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      className={`font-display inline-flex items-center justify-center gap-2 rounded-sm font-semibold tracking-tight shadow-1 transition-colors disabled:opacity-45 disabled:shadow-none ${FACE[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </m.button>
  )
}

/** Square 44 pt icon button. Pass an accessible label. */
export function IconButton({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & HTMLMotionProps<'button'>) {
  return (
    <m.button
      type="button"
      initial={false}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      className={`flex h-11 w-11 items-center justify-center rounded-sm bg-panel text-ink shadow-1 ${className}`}
      {...rest}
    >
      {children}
    </m.button>
  )
}
