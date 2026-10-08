# T114 — Global material icons, debt/exchange and shared CL spend sheet

**Depends on T111–T113.** Read design §§2,7–9, implementation §5 and existing Items, `training-level-up.ts`,
Constellation/Profile/Training navigation and badge reconciliation. This is the usable material-consumption half of
the loop, implemented behind the off cutover gate, not an early TL rename or removal of current training.

## Global Items and original SVGs

Extend established item catalogue/view and SVG icon system. New category/facets are scenario + source style, ordered
registry then Front/Pace/Late/End. All56 current definitions appear under All, owned positive stacks under Owned;
unknown/orphan stacks remain inspectable. Daily Training Ticket, Legacy Universal CL Ticket and scenario/style CL
Ticket have unambiguous different names/accessibility labels. No puzzle-local duplicated inventory.

Author four original ticket base SVGs: constellation-star punch, clear FR/PC/LS/EC strategy glyph/colour, distinct
silhouette from daily/inspiration tokens; composite scenario crest variant. At24/32px use shape/glyph and accessible
label, not tiny text;48/64px result treatments. Test dark/light/grayscale, exactly one Wood-green combat colour and
separate **ticket style** legend from element matchup. Reuse code/vector assets; no bitmap generation/dependency needed.

Items detail and Hub show matching remaining nonpositive bank separately from quantity, explain existing CL is usable,
and link to earned materials/eligible recipients. No negative item stack or vague “earned 12” when 12 were withheld.
All administrative future grants must route through the same repayment helper; don't add an unguarded grant button.

## Exchange screen

Same-style adjacent two-way1:2 with registry-labelled scenario crests. Locked edge explains higher Opening guardian
requirement and links to chapter; unlocked account fact works for any party. Batch positive integer, required stock,
output gross/repayment/net and after-stock/debt preview. Disable insufficient/nonadjacent/unsafe selections.
Confirm irreversible output interception plainly; refresh/reconfirm changed revisions rather than take stale stock.
Call T111 port with operation id; duplicate double tap/retry returns original receipt. Local pending sync is a status,
not a blocking Submit button. No same-scenario cross-style swap or shortcut across multiple scenarios.

## One CL spend sheet — three callers

Profile, Training and Constellation use one component and one host mutation for selected outfit/unlocked scenario.
Behind active cutover, compact `CL n/10` + Level up replaces old training launch intent; before cutover keep old flows
working. Reuse selected scenario/distance navigation, but level is shared across all four distance presets.

Sheet shows original source-A eligible style stocks, separate preserved universal stock, target CL, exact mixed input
counts, total cost, real card nodes opened and stat/SP deltas. Inspect ineligible stocks with reason; cannot select them.
No locked racing scenario target, no change to lineage/Extra stats/card-set assignments, no automatic card slotting.
Up to `10−CL`, ticket-per-level; maxed unit explains no further spend. Existing universal EXP overflow behavior is not
carried into new +1 CL or mint-back loop. A pending/changed racing snapshot remains immutable.

Confirm revalidates revision/ownership/scenario/source/stock under host transaction. Result names actual node ids/
labels from template and says SP gain at9/10 when no new nodes. Link back to correct scenario Constellation. Reconcile
Fully Trained/completion facts exactly once; do not animate Inspiration or Extra stats unlocking. Canonical rejected
offline spend shows recovery and removes unearned CL power while preserving user's configuration for review.

## Tests and acceptance

Inventory56/future registry, ordering/facets/Owned/All/orphans/item deep-links, debt versus stock, SVG legibility proof;
exchange locked edge, both directions, intercepted zero/partial output, stale preview, retry/rollback and overflow;
sheet from all three callers, mixed A-style + universal, ineligible source/style/scenario, CL1/8/9/10, named-node/SP
deltas and unchanged four presets/Inspiration/Extra stats/global stars; badge reconciliation and frozen race remain
unchanged; pending canonical receipt/rejection does not retain false level power. No screen writes the save directly.

Use real-host isolated synthetic Dexie proofs to demonstrate battle→debt→Items→exchange→CL spend without real-account
mutations. Capture390×844 and375×667: Items/detail, debt, both exchange previews including full interception, spend
sheet and9→10 result. `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm sim:puzzles`, `pnpm sim:training` pass; report startup
and changed chunks. Update living planned item/spend/visual contract, append decision for new source/evidence semantics,
delete spec/update M030/index. T115/T116 alone migrate/retire/enable; no live account credit or infra changes here.
