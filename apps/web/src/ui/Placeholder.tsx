/**
 * Deliberate missing-content state: labelled, never a grey box or a broken image
 * (docs/design/visual-system.md#art-treatment).
 */
export function Placeholder({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-sunken text-center ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 20c1.2-5 4-8 8-9" />
        <path d="M13 11c2.4-.6 4.2-2.3 5-4.6.3-.9-.6-1.7-1.4-1.3-1.5.7-3 .8-4.4.4" />
        <path d="M9 20h8" />
      </svg>
      <span className="text-micro px-2">{label}</span>
    </div>
  )
}
