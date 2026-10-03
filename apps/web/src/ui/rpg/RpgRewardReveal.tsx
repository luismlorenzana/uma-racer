// Receipt-based outfit level reveal; previews cannot spend anything (docs/design/uma-rpg.md, T096).
import { STATS, rpgLevelReveal, type RpgProfile, type RpgResultEvidenceV1, type RpgElement } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { RpgPortrait } from './RpgPortrait'
import type { LoadedContent } from '../../content/runtime'
const labels = { speed: 'Speed · ATK/MATK', stamina: 'Stamina · HP/Initiative', power: 'Power · DEF', guts: 'Guts · Dexterity', wit: 'Wit · MP' }
export function RpgRewardReveal({ evidence, profiles, pending, content, name, profileLink, signatures = {}, knockedOut = [] }: {
  evidence: RpgResultEvidenceV1; profiles: RpgProfile[]; pending: boolean; content: LoadedContent | null;
  name: (id: string) => string; profileLink?: (id: string) => string; signatures?: Record<string, RpgElement>; knockedOut?: string[]
}) {
  const reduced = useReducedMotion()
  return <div className="mt-4 space-y-3" aria-label={pending ? 'Unearned progression preview' : 'Accepted outfit progression'}>
    {evidence.memberExp.map((member, index) => {
      const profile = profiles.find((p) => p.outfitId === member.outfitId)
      const reveal = profile && rpgLevelReveal(profile, member)
      return <m.article key={member.outfitId} initial={reduced || pending ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: reduced || pending ? 0 : index * 0.024 }} className="rounded-md border border-hairline-dark bg-stage-soft p-3">
        <div className="flex items-center gap-3"><RpgPortrait content={content} outfitId={member.outfitId} name={name(member.outfitId)} weapon={profile?.weapon ?? null}
          element={signatures[member.outfitId] ?? profile?.defaultSignature ?? null} compact className="h-20 w-16 shrink-0" />
          <div className="min-w-0"><h3 className="text-sm">{name(member.outfitId)}{knockedOut.includes(member.outfitId) ? ' · KO' : ''}</h3><p className="mt-1 text-accent">+{member.delta} RPG EXP{pending ? ' · unearned' : ''}</p>
            <p className="text-xs text-ink-on-dark-soft">Tier {member.beforeTier} · Lv{member.beforeLevel} → Lv{member.afterLevel}</p></div></div>
        {reveal && <><p className="mt-2 text-[11px] text-ink-on-dark-soft">{reveal.levels.length ? `Levels crossed: ${reveal.levels.map((l) => `Lv${l}`).join(' · ')}` : 'No level crossed'}</p>
          <dl className="mt-2 space-y-1 text-[11px]">{STATS.map((stat) => <div key={stat} className="flex justify-between gap-2"><dt className="text-ink-on-dark-soft">{labels[stat]}</dt><dd>{reveal.before[stat]} → {reveal.after[stat]} <span className="text-accent">+{reveal.deltas[stat]}</span></dd></div>)}</dl>
          <p className="mt-2 text-xs">+{reveal.points} tree points · slots {reveal.beforeSlots} → {reveal.afterSlots}</p></>}
        <p className="mt-1 text-xs text-ink-on-dark-soft">{member.afterLevel === 50 ? `${member.afterExp} EXP banked · manual promotion available` : `${member.afterExp} EXP toward next level`}</p>
        {!pending && profileLink && <Link to={profileLink(member.outfitId)} className="mt-2 flex min-h-11 items-center text-sm text-accent">View RPG profile</Link>}
      </m.article>
    })}
  </div>
}
