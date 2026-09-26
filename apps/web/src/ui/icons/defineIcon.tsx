import type { CSSProperties, ReactNode, SVGProps } from 'react'
import type { IconName } from './names'

export type IconSize = 16 | 20 | 24 | 32
/** `line` by default, `solid` for active states, `duotone` for the illustrated tab and currency icons. */
export type IconVariant = 'line' | 'solid' | 'duotone'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'fill' | 'stroke' | 'width' | 'height'> {
  size?: IconSize
  variant?: IconVariant
  /** The duotone fill; the accent token unless the icon sits on the accent (the raised Race tab). */
  accent?: string
  /** The accessible name. Without one the icon is decorative and must sit beside a visible label. */
  title?: string
}

export interface IconComponent {
  (props: IconProps): ReactNode
  readonly iconName: IconName
  displayName?: string
}

/**
 * One icon's drawing on the 24 grid (docs/design/visual-system.md#iconography). `line` is the outline; `detail` holds
 * the inner marks, knocked out of a solid silhouette; `tone` is the filled silhouette that duotone paints in the accent
 * and solid in the icon's own colour. Icons without a tone draw the same in every variant.
 */
interface IconDrawing {
  line: ReactNode
  detail?: ReactNode
  tone?: ReactNode
}

const TONE = 'var(--icon-tone, var(--color-accent))'
const CUT = 'var(--icon-cut, var(--color-panel))'

export function defineIcon(name: IconName, drawing: IconDrawing): IconComponent {
  function Icon({ size = 24, variant = 'line', accent, title, style, ...rest }: IconProps) {
    const filled = variant !== 'line' && drawing.tone !== undefined
    const knockout = filled && variant === 'solid'
    const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true }
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        data-icon={name}
        {...label}
        style={accent ? ({ ...style, '--icon-tone': accent } as CSSProperties) : style}
        {...rest}
        className={`shrink-0 ${rest.className ?? ''}`.trim()}
      >
        {filled && <g stroke="none" style={{ fill: variant === 'solid' ? 'currentColor' : TONE }}>{drawing.tone}</g>}
        {drawing.line}
        {drawing.detail !== undefined && (knockout ? <g style={{ color: CUT, stroke: CUT }}>{drawing.detail}</g> : drawing.detail)}
      </svg>
    )
  }
  Icon.displayName = `Icon(${name})`
  return Object.assign(Icon, { iconName: name })
}
