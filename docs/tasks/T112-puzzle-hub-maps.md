# T112 — Global Hub, roster, five parties and chapter maps

**Depends on T111's real host and T109 content runtime.** Read design §§3–4,6,9, implementation §§5,9 and current RPG
Hub/roster/map components for visual patterns, not current RPG mechanics. One UI PR; release capability stays off.

## Screen/navigation contract

Add lazy Puzzle routes under one global root (follow the existing RPG route conventions), separate account selectors
and their own internal navigation: Parties/Roster/Chapters/Exchange/Items. Home's launch component can be authored
now but must remain behind the off capability, verified content and active account gate. Deep links cannot bypass it.
No new global bottom tabs or Profile/Training launch removal yet. Use shared shell/header/back/guide, not a footer
full of Sync/Submit controls. Returning remembers chosen party/chapter, not an Uma picker on every entry.

Implement Hub resume cards, roster/detail/enrollment, party editor, chapter launch pad, map and node preview against
the real host. T114 supplies finished Exchange/Items/material surfaces; unavailable interim destinations are honest,
not no-op buttons. T113 supplies the battle route; until then Begin opens a visible isolated proof/disabled state only
in DEV, never reserves an unwinnable real production fight.

## Roster and enrollment

- Five compact icons per row; enrolled before unenrolled, stable name/id order, element + PL overlays. Use owned
  outfits, not all catalogue entries; never import another mode's EXP/class. Filters don't reorder stored progression.
- Enrollment sheet shows original A source grades, permitted palette under exact Dirt/Light/Dark/basic rules,
  owned-roster colour counts, starting stats and eligible active archetypes. Suggest underrepresented colour without
  preselecting/confirming it. Fixed-element outfits explain why; no-A outfits visibly unavailable, not hidden/deleted.
- Detail shows frozen element/source/version, PL/EXP, five stat contributions, next-level deltas, unlocked active/
  leader/pattern choices and first-entry element lock. Before first entry offer correction; after loss/abandon still
  locked. No new racing-style default or RPG weapon choice is written.

## Party editor

Exactly five named presets, five distinct nullable ordered slots; slot1 leader. All filled to enter. Picker excludes
current draft duplicates and normally other-party assignments. A deliberate transfer flow names source/destination,
confirms removal, revalidates both revisions and preserves checkpoints. Both sides' open battles block transfer.
Loadout/leader controls offer only unlocked choices; slot moves update leader preview. Show element coverage, shared
HP/RCV/guard, average/range PL and low-level warning. Multiple alternate outfits of one character are allowed.
No required rainbow quota or Front/End quota, no free sixth helper and no silent auto-move like legacy RPG code.

## Launch pad/map/preview

All registered scenario crests with ten-level recommended bands, full-party requirement, clear/resume status and
material families. Racing scenario ownership is not a chapter gate. Each party/scenario has independent remembered
map position, wins and open battle. Resume labels name the open node, not a fresh Begin.

Render the 28-node top-to-bottom map with three sector guardians and five final colour routes. Nodes show level,
enemy element triplet/mono boss, reached/won/replayable state and exact material glyphs. Do not clone RPG's camps or
two-step Finals. Both branch choices available at a reached row, either advances; all three guardians before Finals.
Preview lists enemies/art, role/intents/phases/immunity, weakness legend, level warning, gross vector and current
repayment/net estimate. Dark boss PC/LS choice is explicit and frozen by reservation. A phase cannot alter drop copy.
Opening guardian explains newly unlocked adjacent exchange edge; chapter-complete differs from full-map clear.

Open foreign/missing-journal encounter exposes read-only state plus T111 explicit takeover/recovery, not a new seed.
Preview content failure is visible Retry/Return; verified pack is required before a real reservation. No Sync-first UI.

## Layout/accessibility and tests

Use portrait 390×844 and 375×667, ≥44 pt actions even with five icons, shell safe padding once, short labels, accessible
element/style names and selection/focus states. Scroll inside roster/map as needed; T113 fight has no page scroll.
Motion is `m.*`, transform/opacity and reduced-motion-safe. Art uses held leases. Maps have DOM labels/preview controls,
not inaccessible canvas-only nodes. Keep guide button wired even before full T113 illustrated pages land.

Component/presentation tests: roster ownership/order/filters/overlays, enrollment mapping/confirmation/no-A, correction
lock, no duplicate slots, confirmed/stale/blocked transfer, partial party, slot1 preview, unlocked kit only; all14
scenario bands; branch/guardian/finals routing; Dark pre-entry choice; true Resume; unavailable content/foreign journal;
back/deep-link guards and no real-account operation in a DEV proof. Test selectors don't repaint board every pointer move.

Create an isolated synthetic DEV phone proof wired through a real host and separate database namespace, with no auth
or production rewards. Capture Hub/roster/editor/map/preview screenshots at both sizes. Private original-art screenshots
must remain ignored/outside git; attach them to private PR only when appropriate, not as checked-in fixtures.

## Acceptance

The UI reflects saved real contracts with no dummy default production party/roster/map and no direct Dexie writes.
Registration and transfer copy explain irreversible/locked choices. Run lint/test/build + sim:puzzles; report exact
startup and Hub/map chunks (≤180 KB startup), attach phone-size shots and record browser proof separately from owner
device testing. Update living screen/navigation docs/kit, delete spec/update M030/index. Home activation, battle,
material implementation and live migration remain T113–T116.
