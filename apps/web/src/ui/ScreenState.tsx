import { Link } from 'react-router'
import { Panel } from './Panel'

export function ScreenState({ title, detail, action }: { title: string; detail: string; action?: { label: string; to: string } }) {
  return (
    <Panel className="mt-3 text-center" role="status">
      <p className="text-lg font-extrabold">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{detail}</p>
      {action && (
        <Link to={action.to} className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-sky px-5 font-extrabold text-white text-outline">
          {action.label}
        </Link>
      )}
    </Panel>
  )
}
