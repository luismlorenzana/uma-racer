import { Link } from 'react-router'
import { Panel } from './Panel'

export function ScreenState({ title, detail, action }: { title: string; detail: string; action?: { label: string; to: string } }) {
  return (
    <Panel className="mt-3 text-center" role="status">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{detail}</p>
      {action && (
        <Link
          to={action.to}
          className="font-display mt-4 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-semibold text-ink shadow-1"
        >
          {action.label}
        </Link>
      )}
    </Panel>
  )
}
