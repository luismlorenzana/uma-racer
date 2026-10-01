# T103 — All-scenario RPG coverage and balance closure

**Outcome:** the RPG has verifiably playable, distinct chapters and earnable Inspiration tokens for **all fourteen**
current scenarios. Depends on T100–T102 plus T099's first chapter. Read [M029](M029-rpg-chapter-rollout.md),
[RPG design](../design/uma-rpg.md) and [implementation contract](../technical/uma-rpg-implementation.md).

## Closure matrix

- Private validator reports 14/14 reachable, versioned chapters; 14/14 scenario ids; complete actor/skill/portrait/
  phase references; no synthetic production fallback; and a hash for each pack. Public PR contains aggregate
  counts/hashes only. A missing, stale or unauthorized pack is surfaced without blocking an unrelated cached one.
- Headless RPG sim walks at least one win and one loss/retry route per scenario with fixed synthetic seeds, five
  outfits across class/element configurations, and two full promotion tiers. Report chapter length, battle turns,
  loss/clear distribution, XP gains for under/at/over-level parties, HP/MP pressure and token count. Any change to
  a shared numeric rule updates design, decision log and `domain.test.ts` pin; no private roster row enters tests.
- Browser chapter picker lists every authored scenario with correct recommended level and no order gate. Complete
  at least one real first/middle/last-tier chapter including boss result→matching Item→Inspiration spend; reopen an
  old checkpoint after newer publication; switch presets and devices; confirm same-seed retry and exact-once grant.
  Owner physical-iPhone spot check covers a short and long chapter, safe areas, audio/reduced motion and offline
  pending/reconnect. Report startup gzip ≤180 KB and RPG chunk size.

`pnpm lint`, `pnpm test`, `pnpm build`, all RPG sims and private validation pass. Update the design/README coverage
status, record owner device result and delete T103 and M029 in this PR (D104). If even one scenario is unpublished,
leave M029 open with the missing scenario named **without exposing private opponent rows**.

**Out of scope:** future scenario releases, new classes, expansion story, PvP or distribution of third-party assets.
