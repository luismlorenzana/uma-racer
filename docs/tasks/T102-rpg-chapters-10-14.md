# T102 — RPG chapters for scenario tiers 10–14

**Outcome:** The Twinkle Legends, Design Your Island, Yukoma Hot Springs, Beyond Dreams and Tracen Diner each have a
published private RPG chapter and matching scenario token. Depends on T101 and latest `main`. Read
[M029](M029-rpg-chapter-rollout.md) and [the implementation contract](../technical/uma-rpg-implementation.md).

## Delivery contract

- Author five versioned private graphs with playable PriConne character teams, distinct branching tactical choices,
  correct previews and phase-changing bosses. Validate every portrait variant, legal kit, affinity, phase and graph
  edge. New packs never rewrite a frozen old encounter; verify a paused earlier chapter after publication.
- Run synthetic and private dry-run scenarios for a party with mixed class tiers and bounded legacy loadouts, a
  low-level party taking a high-tier warning, a fully promoted outfit and a party with no Front/End. The warning is
  advisory; no chapter-order gate is added. Verify late-tier heal/guard and weakness interactions still matter and
  that an overleveled replay gives positive but tapered EXP.
- Privately publish all five; report hashes and aggregate validator counts only. A general importer/engine fix goes
  through an invented fixture and all earlier-chapter regression, never through a hard-coded copyrighted roster row.
  Browser-play a route, alternate fork, loss/retry and clear/replay per new chapter and verify each token id.

`pnpm lint`, `pnpm test`, `pnpm build`, RPG sims and private validation pass. Report startup gzip/RPG chunks and
screenshots for screen changes. Update coverage table and delete this spec in its PR (D104). Publication failure
keeps the task open.

**Out of scope:** redesigning promotion, unlimited active skill slots or claiming full coverage before T103 audits it.
