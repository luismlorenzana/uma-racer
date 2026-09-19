import { m } from 'motion/react'
import { Panel } from '../ui/Panel'

/** Planned tab screens, styled like the game so the shell can be felt on-device before features land. */
export function PlaceholderScreen({ title, emoji, lines }: { title: string; emoji: string; lines: string[] }) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="font-display px-1 text-2xl font-bold tracking-tight text-ink">{title}</h1>
      <Panel className="flex flex-col items-center py-8 text-center">
        <m.span
          className="text-7xl"
          initial={{ scale: 0.6, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          aria-hidden
        >
          {emoji}
        </m.span>
        <p className="mt-4 text-lg font-extrabold">Coming soon</p>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-soft">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
