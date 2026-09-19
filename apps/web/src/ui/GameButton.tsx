import type { HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import { Button, type ButtonVariant } from './Button'

/**
 * Compatibility shim for screens that still call the old chunky button. `go` was the green
 * race button; it maps to the single accent. Removed by T031 once every screen uses `Button`.
 */
export function GameButton({
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}: { variant?: 'primary' | 'go' | 'secondary'; size?: 'md' | 'lg'; children: ReactNode } & HTMLMotionProps<'button'>) {
  const mapped: ButtonVariant = variant === 'secondary' ? 'secondary' : 'primary'
  return (
    <Button variant={mapped} size={size} {...rest}>
      {children}
    </Button>
  )
}
