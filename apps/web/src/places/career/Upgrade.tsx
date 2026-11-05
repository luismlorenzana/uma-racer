// A career's Upgrade (docs/game/11-hub-and-places.md §3.2; D387), `/career/careers/:careerId/upgrade?tab=`: one screen
// over the wallet and her stats now, with four tabs, each counting what she can buy there: **Tree** (`TreeTab`),
// **Deck** (`DeckTab`), **Bonds** (`BondsTab`) and **Skills** (`SkillsTab`). It opens on the tab the season card
// chose (the first with something to buy). Back returns to her career. A completed career's build is frozen, so its
// Upgrade goes back to the career.
import { Tabs } from '@luismlorenzana/uma-kit/ui'
import { careerStats, skillPoints } from '@racer/domain/build'
import type { Place } from '@racer/domain/hub'
import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useGame } from '../../app/game'
import { careerPath, isUpgradeTab, UPGRADE_TABS, type UpgradeTab } from '../../hub/nav'
import { StatRow } from '../../ui/BuildFacts'
import { PlacePageHeader } from '../PlacePageHeader'
import { BondsTab } from './BondsTab'
import { DeckTab } from './DeckTab'
import { buildView, careersWords, upgradeCounts, type CareersWord } from './model'
import { SkillsTab } from './SkillsTab'
import { TreeTab } from './TreeTab'
import { Wallet } from './Wallet'

const TAB_WORD: Readonly<Record<UpgradeTab, CareersWord>> = { tree: 'tab-tree', deck: 'tab-deck', bonds: 'tab-bonds', skills: 'tab-skills' }

export default function Upgrade({ place, rest, careerId }: { place: Place; rest: string; careerId: string }) {
  const [params, setParams] = useSearchParams()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const career = state?.careers[careerId]
  const view = useMemo(() => (career === undefined || state === null || env === null ? null : buildView(career, state, env)), [career, env, state])
  const counts = useMemo(() => (career === undefined || state === null || env === null ? null : upgradeCounts(career, state, env)), [career, env, state])
  const asked = params.get('tab')
  const tab: UpgradeTab = isUpgradeTab(asked) ? asked : 'tree'
  const setTab = (next: UpgradeTab) => {
    const search = new URLSearchParams(params)
    search.set('tab', next)
    setParams(search, { replace: true })
  }

  if (career !== undefined && career.completedAt !== null) return <Navigate to={careerPath(careerId)} replace />
  const uma = career === undefined ? undefined : env?.content.umas.get(career.umaId)
  return (
    <div data-place-page="careers" data-racer="upgrade" data-career={careerId} data-tab={tab}>
      <PlacePageHeader place={place} rest={rest} title={careersWords('upgrade')} back={careerPath(careerId)}
        lines={[careersWords('about-upgrade'), careersWords('about-derived')]} />
      {career === undefined || state === null || env === null || view === null || counts === null || uma === undefined ? (
        <p className="px-4 py-6 text-[14px] text-ink-soft">{careersWords('unknown-career')}</p>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <Wallet wallet={career.wallet} sp={skillPoints(career, view).available} />
          <section aria-label={careersWords('her-stats')} className="rounded-md border border-hairline bg-panel px-2 py-1.5" data-racer="her-stats">
            <StatRow stats={careerStats(career, view)} />
          </section>
          <Tabs label={careersWords('tabs')} value={tab} onChange={setTab}
            options={UPGRADE_TABS.map((value) => ({ value, label: counts[value] > 0 ? `${careersWords(TAB_WORD[value])} · ${counts[value]}` : careersWords(TAB_WORD[value]) }))} />
          {tab === 'tree' && <TreeTab key={careerId} careerId={careerId} career={career} view={view} />}
          {tab === 'deck' && <DeckTab careerId={careerId} career={career} state={state} env={env} />}
          {tab === 'bonds' && <BondsTab careerId={careerId} career={career} state={state} env={env} />}
          {tab === 'skills' && <SkillsTab careerId={careerId} career={career} state={state} env={env} view={view} uma={uma} />}
        </div>
      )}
    </div>
  )
}
