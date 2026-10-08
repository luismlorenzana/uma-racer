# Uma Puzzles materials — synthetic browser proof (T114 / D283)

2026-10-08. This is **desktop browser proof at phone viewport sizes**, not physical-iPhone acceptance or enabled
production gameplay. Both release capabilities remain off. No owner save, account credit/bank preparation, migration,
private roster, imported art or content publish was used. T109 permitted originals remain owner-pinned; T115–T116 remain.

## What runs

The DEV-only `/dev/puzzles-ui-proof` account uses the real persistent Puzzle host, isolated Dexie database
`puzzle-proof-t114-ui-v1`, invented outfits and synthetic template content. Items are the ordinary global Item rows,
not a second Puzzle inventory. Browser confirmations only touch this isolated account. Its deliberately chosen
stock/debt/CL9 examples demonstrate transactions and UI states, not balance.

- Global Items: Owned positive stacks, All56 scenario/style definitions, intersecting scenario/style facets and an
  inspectable invented orphan. Detail separates stock5 from Front/URA bank−7 and names eligible original-A recipients.
- Bank: retained scenario/style rows explain future repayment; existing CL and stock are still usable.
- Up-conversion: two Front/URA tickets → one Front/Unity; input5→3, output6→7, no output debt.
- Full interception: one Front/Unity → two Front/URA; gross2/repaid2/net0, input6→5, output stays5, bank−7→−5.
- Partial interception: six Front/Unity → twelve Front/URA; gross12/repaid7/net5, input6→0, output5→10, bank reaches0.
  Both intercepted previews require explicit irreversible acknowledgement before confirmation.
- Shared spend sheet: one Front/URA ticket raises CL1→2, names actual card nodes `n3`/`n4` and shows SP+80.
  Ineligible stocks remain inspectable. Confirmation stays in the safe-area thumb footer while details scroll.
- Actual saved result: Evening Star CL9→10 consumes one preserved universal, shows SP+80 and no new card nodes.
  Its pending receipt is explicitly not permanent accepted completion evidence; presets/assignments remain unchanged.
- Original vectors: 24/32/48px on dark, light and grayscale; 64px in item detail. Positional running-style glyphs and
  scenario insets accompany colour. Daily Training, Legacy Universal CL and Inspiration keep distinct names/shapes.

## Screenshots

All images below are original UI/vectors and synthetic account state; no extracted game art or rows.
375×667 captures intentionally show the scrolled viewport, not an artificial full-page montage.

| State | 390×844 | 375×667 |
|---|---|---|
| Global Items | [JPEG](puzzle-materials/items-390x844.jpg) | [JPEG](puzzle-materials/items-375x667.jpg) |
| Separate repayment bank | [JPEG](puzzle-materials/bank-390x844.jpg) | [JPEG](puzzle-materials/bank-375x667.jpg) |
| Ticket detail / eligible recipients | [JPEG](puzzle-materials/detail-390x844.jpg) | [JPEG](puzzle-materials/detail-375x667.jpg) |
| Shared CL spend sheet | [JPEG](puzzle-materials/spend-390x844.jpg) | [JPEG](puzzle-materials/spend-375x667.jpg) |
| Saved CL9→10 / SP-only result | [JPEG](puzzle-materials/result-390x844.jpg) | [JPEG](puzzle-materials/result-375x667.jpg) |
| Adjacent up-conversion | [JPEG](puzzle-materials/exchange-up-390x844.jpg) | [JPEG](puzzle-materials/exchange-up-375x667.jpg) |
| Down-conversion / full interception | [JPEG](puzzle-materials/exchange-debt-390x844.jpg) | [JPEG](puzzle-materials/exchange-debt-375x667.jpg) |
| Down-conversion / partial interception | [JPEG](puzzle-materials/exchange-partial-390x844.jpg) | [JPEG](puzzle-materials/exchange-partial-375x667.jpg) |
| Original vector contrast proof | [JPEG](puzzle-materials/icons-390x844.jpg) | [JPEG](puzzle-materials/icons-375x667.jpg) |

## Automated evidence

`pnpm lint`, `pnpm test` (**1418 tests across six packages**) and `pnpm build` pass after rebasing over the latest RPG
class work. Nineteen new tests cover registry/future definitions, facets/ordering/orphans, literal-A and exact mixed
spends, safe batches, real isolated host-backed screens, locked edges, both directions, full/partial interception,
stale/reconfirmed previews, exact lost-acknowledgement retries, CL9/10, unchanged configuration/frozen Puzzle inputs,
canonical CL/exchange rejection and battle→repayment→Items→exchange→CL. Existing host transaction/rollback,
badge reconciliation and frozen Racing tests still pass; no economic reducer or race snapshot code changed.

All three live callers use the same lazy sheet. Off-gate tests render the adapters without a host/account provider:
current TL/Spark navigation stays intact and no bank/content/account boot occurs. Pending sync has a status, never
a blocking Submit step. Canonical rejection replaces predicted CL/exchange success with current canonical state.

`pnpm sim:puzzles` passes600 campaign battles and unchanged exact regression/hash envelopes; known T116 balance
gaps are not closed. `pnpm sim:spark` passes900 runs:77% clears, mean Drive60, style gap4%, paid TL1→10 median6/p908.
`pnpm sim:training -- --content=/Users/luismartinez/workspace/uma-racer/content/data` passes all existing bands,
240 seeds per row (foundation93/78/74%, scenario twists77–84%). Only aggregate rates were inspected.

Production measurements below are individual gzip chunks, not a sum of shared dependencies. DEV proof fixture
strings and routes are not shipped. Startup remains below180KB; Pixi/Firebase stay lazy.

| Chunk | gzip KB |
|---|---:|
| Startup entry | 153.26 |
| Puzzle materials / exchange | 3.41 |
| Shared CL spend sheet | 3.44 |
| CL live adapter | 1.71 |
| Thin off-gate adapter | 0.58 |
| Global Item inventory | 4.56 |
| Spark Match | 18.05 |
| Shared Pixi entry | 85.30 |

## Remaining release gates

This proof cannot establish physical touch/finger occlusion, safe-area behaviour on the owner's PWA, VoiceOver,
sustained60/120Hz or enabled production migration. T115 owns preservation/conversion/retirement; T116 owns release,
balance closure and the owner protocol. Real permitted PAD content/import/publish remains the pinned T109 pass.
No live account credit or infrastructure change is part of T114.
