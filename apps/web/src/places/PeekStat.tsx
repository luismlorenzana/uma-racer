// A quick look's number (docs/game/11-hub-and-places.md §2.6; D386): an icon, a big number and its label, two to a row
// in the Stable's and the Card Library's Peeks. Theme tokens only.
import type { ReactNode } from 'react'

export function PeekStat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="rounded-md bg-raised p-3" data-racer="peek-stat">
      <p className="text-micro">{label}</p>
      <p className="font-display mt-0.5 flex items-center gap-1.5 text-2xl font-bold">
        {icon}
        <span className="numeral">{value}</span>
      </p>
    </div>
  )
}
