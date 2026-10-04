# T105 — One-time Inspiration advance

Owner detour, independent of card sets and the RPG playable-release/content gates.

## Contract

- First updated online sync freezes authoritative owned outfits and their already-unlocked scenario units.
- Open six lineage slots and twelve gold positions per unit. Charge six Slot and twelve Skill tokens, including
  already-open positions. Inherited Unique belongs to its slot, not another Skill token.
- Nonpositive balances are separate for every scenario/token family. Preserve inventory, ancestors, four distance
  presets, EXP, careers, Training Levels, cards and Extra stats. Never choose ancestors automatically.
- Freeze the cohort once; later outfits/scenarios are excluded. Protected server processing opens/debits one outfit
  atomically, resumes interruptions and cannot be invoked through ordinary sync. No production credentials needed.
- RPG grants retain gross frozen rewards and ledger identity. Atomically repay matching debt first; only overflow
  joins Item inventory. Ledger repayment metadata must survive reconstruction, retries and device changes.
- Show debt in Items/Inspiration and gross, repayment and net totals on chapter results.

## Acceptance

Synthetic tests: mixed existing/new unlocks, unchanged presets, frozen cohort, partial resume, concurrent devices,
duplicate acknowledgements, family-specific repayment, zero net, overflow, old-client omission and ledger rebuilding.
Ordinary writes cannot close permanent unlocks or edit the bank. Startup waits for pending work, safely adopts
acknowledged rows and retries. Lint/test/build and RPG sims pass; startup <=180 KB gzip; 390×844 synthetic proof.
Branch, PR and CI before merge. Delete this spec in the implementation PR once design/technical docs carry the rules.
