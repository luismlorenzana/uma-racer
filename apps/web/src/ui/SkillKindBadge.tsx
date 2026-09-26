// A skill's kind as a small badge: unique, inherited unique (from her lineage, D174), gold or white.

const KIND_BADGE: Record<string, { label: string; tone: string }> = {
  unique: { label: 'Unique', tone: 'bg-ink text-ink-on-dark' },
  'unique-upgraded': { label: 'Unique', tone: 'bg-ink text-ink-on-dark' },
  'inherited-unique': { label: 'Inherited unique', tone: 'bg-gradient-to-r from-stat-guts to-stat-speed text-white' },
  gold: { label: 'Gold', tone: 'bg-accent text-ink' },
  white: { label: 'White', tone: 'bg-sunken text-ink-soft' },
}

export function SkillKindBadge({ kind }: { kind: string }) {
  const badge = KIND_BADGE[kind] ?? { label: kind, tone: 'bg-sunken text-ink-soft' }
  return <span className={`shrink-0 rounded-xs px-1.5 text-[10px] leading-4 font-bold uppercase ${badge.tone}`}>{badge.label}</span>
}
