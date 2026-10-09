# T122 — Five phone districts, crew, cookbook, Items and Energy

**M031 · after T121 merges · real host, isolated proof, release off.** Read AGENTS/README/index,
[M031](M031-farm-kitchen-rework.md), [design §§3–8,12–14](../design/farm-kitchen-rework.md),
[technical §7](../technical/farm-kitchen-implementation.md), minigame-kit, Paddock visual-system and actual
T121 port/receipt shapes. Inspect existing Farm/Items/guide/worker-picker primitives before replacing them.

## Goal and boundaries

A cozy self-contained global activity, not an Uma-selection interstitial or 30 timer cards stacked on one page.
All five districts have six open spots; persistent outfit workers/levels and original scenario foods are visible.
Recipe planning/collection and finished dishes make output purposeful. Every mutation calls the real host.
Normal Home/old Farm stays unchanged while capabilities are off; DEV proof has no owner auth/storage access.

## Screen contract

### Hub, routes and six-station field

- Lazy `/farm` Hub: five district cards, assigned/busy/ready counts and next finish, crew/recipe/global Items
  shortcuts, pinned meals, contextual Help and Back→Home. No aggregate Farm Level or next-slot meter.
- `/farm/district/:districtId`: 2 columns×3 rows, compact district switch/header; all six tiles visible without
  page scroll at 390 × 844 and 375 × 667. One primary action per tile (Assign/Choose/Collect), outfit portrait/chibi,
  Farm Level, readable food/stat symbol and time/Ready/Pending text. No Locked station state.
- Worker/recipe/energy/detail sheets may scroll internally with 44 pt controls above safe area. Reduce decorative
  padding/art before touch targets/fonts. Increased system text uses a documented accessible scrolling fallback.
- Remember last district/filter/density account-locally; opening any page is write-free. Old Section 1/2/3 links
  redirect to Garden/Orchard/Barnyard; legacy crop links remain findable from Recipes/Items, not a dead route.
  Invalid/unavailable targets get a named Retry/Back state, never an invented content-not-imported gate.

### Crew and assignment

Working/Available sections show each owned **outfit**, Farm-level descending then display name/id. No character
collapsing or global featured-Uma choice. A spot's picker selects/removes/moves idle workers explicitly with the
destination in confirmation. Busy/Ready workers link to their station and cannot be moved/cancelled. Selected
recipe may change while idle without reselecting the worker. Do not show obsolete expertise/slot counters.

### Catalogue, cookbook and shopping

- 16 meal recipes per block; registered scenarios expose their distinct Garden/Orchard/Barnyard/processed
  ingredients. Show 5 milk/cheese lanes, raw personal level gates and shared block processing/cooking milestone.
  Explain that an open station still needs recipe eligibility and inputs. Later flavours never lock the map.
- Recipe detail shows named/signature output, chosen batch 1–4 chips, exact concrete raw/processed substitutions,
  available/reserved/pending quantities, fixed duration, 12 EXP/job and ready time. Default maximum only when it
  is legal and supplied; never silently shrink a previously confirmed batch or spend different substitutions.
- Recipes are visible before eligibility; every disabled Start names its missing worker level/shared milestone/
  input and links to a relevant worker/district. Recipe choice is explicit, not a hidden combination lottery.
- Cookbook records first successful preparation and total meals claimed from canonical receipts. Pending first
  preparation is marked pending, not permanently completed. Variant discovery is inventory history, no currency.
- Pin up to 3 recipe/quantity goals in account-scoped device preferences. Planner computes per-slot ingredient
  needs, already-owned finished meals, raw/processed stock and known pending/ready outputs in separate columns.
  It must not double-count one stock unit across two wishlist entries, or claim an unclaimed output is canonical
  spendable stock. Deterministic suggestion order: selected legal substitution, then sufficient stock/name/id;
  surface unresolved alternatives rather than pretend fragmented stacks can satisfy one concrete batch slot.
- A shortage links to production choices and eligible workers. Preview recursive raw needs for missing processed
  units using rounded six-unit jobs; no cyclic dependencies/cross-block merges. A large Sun-batch plan explicitly
  shows its stock/preparation burden instead of promising usual average throughput.

### Claims, inventory and Energy

Collect shows the real output icon/count, worker EXP before/after and every crossed level, recipe milestone or
first-preparation name. Provide deliberate Repeat/Choose/Items. Repeat revalidates all input/eligibility and
captures a new intent only on confirmation; no auto-start. Collect all returns actual succeeded/pending/failed
jobs individually, preserves assignment and has no hidden ingredient spend. Historical receipts do not replay
celebration or claim success after a rejected/unknown acknowledgement.

Extend the existing global Items join/rendering with raw/processed/meals/Energy and scenario/block/stat facets,
retained Legacy Produce labels, canonical/reserved/pending quantities and useful details/deep links. Preserve
training/Constellation/Inspiration materials/debt views; no Farm-only second bag. New 1169 definitions are lazy
and bounded/windowed; rendering All must not load every Uma image or all history per tick.

Replace the new-generation debug time-shift action with **Grant 50 Energy**. One deliberate press creates one
durable grant intent. Station detail's **Use Energy ·1** shows only that job's before/after and any wasted
minutes; idle/ready/missing Energy disables spend. No Farm EXP/output until Claim. Legacy time shift remains
only for unreleased/v2 compatibility; never apply it to all v3 workers.

## Art, guide and accessibility

Author repo-native SVGs through the existing glyph system: five district signs; 7 raw family/9 processed
silhouettes with recognizable vegetable/fruit variation; 5 pure/10 pair/1 Sun meals and Energy. Combine stat glyph,
scenario/block crest and name to distinguish variants, not 1169 bespoke assets or two nearly identical greens.
Reuse verified private Uma art in real use; screenshots use **invented silhouettes only**, no extracted images
or real account data in git. No asset pipeline/publication dependency or new graphics library.

Use shared shell/header/Button/BottomSheet/TypeIcon/Meter/CountUp and `m.*` under LazyMotion strict. Animate only
transform/opacity, delta-timed and visibility-paused. Short preparation/plating/item reveals are presentation;
no required gesture minigame, cooking quality, burn/loss or score/time/yield bonus. Reduced motion is equally legible.

Versioned `FarmKitchenGuide` uses PagedGuide/createGuideMemory, opens once per device before the first new job
and is always reachable with contextual start page. Teach global crew/all 30 spots, personal versus account
items, scenario flavours/block gates, raw→processed→meals, substitutions/batches, cookbook/wishlist, Extra
buy versus free activation, single-job Energy/debug and pending sync/recovery. Numeric copy imports rules,
not duplicated literals; guide components/illustrations never call the host.

Focus trapping/return, sheet Escape/Back, labels for truncated outfit/recipe names, polite single live region
for saves/claims, keyboard controls and no colour-only state. Safe areas applied once. Phone proof measures
scrollHeight/clientHeight and action rectangles, not merely a screenshot that hides a clipped last row.

## Tests / proof deliverables

- Pure view/stock planner tests: equal stat lanes, no cross-block substitutions, stock shared by wishlist goals,
  pending versus spendable, batch rounding, max/partial input choices, disabled reasons and stable sort/preferences.
- Component/source tests: no legacy locks/aggregate levels, no native `<select>`,44 pt controls, guide rules-linked,
  no unguarded runtime/account import in proof, no direct writes or required cooking gestures.
- Isolated **real Dexie host** DEV-proof entry, unique named invented DB per run, auth/game boot bypass. Cover
  assign→raw→processing→meal, pending/rejected/retry, grant/use Energy, Collect all partial failures and reload.
  Use injected time only in proof, never a hidden production time control.
- 390 × 844 and 375 × 667 screenshots in `docs/research/farm-kitchen-phone-proof/`: Hub, all five districts,
  Working/Available picker, quantity/substitution recipe sheet, wishlist/shopping, claim/result, global Items/
  Legacy stock, Energy and contextual guide. Add a README with fixture setup, measured fit/targets, actual
  persisted receipt/hash checks, limitations and no owner-device sign-off claim.
- Lint/test/build, both new Farm sims and affected legacy/global Items/Puzzle/RPG checks. Startup ≤ 180 KB gzip,
  record Farm/catalogue/icon/guide lazy chunk sizes and verify no private art or large food catalogue enters startup.

Update design screen/guide sections and technical §7 to actual shipped-but-dormant routes/assets, append decision,
M031/index and D104 deletion. Complete/merge before T123. No production Home replacement, flags, owner reset/
grants, infrastructure, private content publish, constellation purchase wiring or mechanics in other modes.
