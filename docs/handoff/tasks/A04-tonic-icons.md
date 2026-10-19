# A04 — The ten tonics' item icons

**Priority: next · ChatGPT · uma-platform · S.** Ready.

## Why

Since D375 uma-racer's Kitchen brews **tonics**, one per grade, which pay constellation nodes and Inspiration slots
(stat meals pay the Gym; bonds take nothing). uma-art has no frames for them, so the Kitchen's Tonics tab, the
Warehouse's Tonics shelf, the session sheets and the slot rows draw each tonic as its name on a plain tile. The other
Kitchen items are all uma-art's 32×32 dish icons, so the plain tiles stand out.

## Context

- **uma-racer:**
  - [docs/game/08-item-catalogue-and-recipes.md](../../game/08-item-catalogue-and-recipes.md) §4.5 (the tonics, their
    names and recipes) and §10 (ids, names and art);
  - [docs/game/11-hub-and-places.md](../../game/11-hub-and-places.md) §10.3, "Not drawn yet: the ten tonics";
  - `apps/web/src/ui/ItemIcon.tsx`: a tonic takes the `items` frame of its own id as soon as the pinned release has
    one, exactly as the Speed Ticket does (`speed-ticket`, A02).
- **uma-platform:**
  - `scripts/pixel-art/src/items/` (32×32 item icons; the `speed-ticket` frame A02 appended is the precedent);
  - `packages/art/README.md`.

## Do

1. **`items` atlas, appended** after the existing items, so every published frame keeps its place: ten frames at
   32×32, keyed by the tonic ids `tonic-1` … `tonic-10`:

   | Id | Name | Grade |
   |---|---|---|
   | `tonic-1` | Warm-Up Tonic | 1 |
   | `tonic-2` | Practice Tonic | 2 |
   | `tonic-3` | Paddock Tonic | 3 |
   | `tonic-4` | Gallop Tonic | 4 |
   | `tonic-5` | Stride Tonic | 5 |
   | `tonic-6` | Stretch Tonic | 6 |
   | `tonic-7` | Spurt Tonic | 7 |
   | `tonic-8` | Derby Tonic | 8 |
   | `tonic-9` | Champion's Tonic | 9 |
   | `tonic-10` | Legend's Tonic | 10 |

   One design across the set: a small stoppered bottle (a sports-drink or herbal-tonic flask, not a fantasy potion),
   whose liquid and label colour rise with the grade, and whose shape gains a detail every few grades (a ribbon, a
   wax seal, a gilded cap), so the ten read as a ladder at a glance. Grades 9 and 10 carry the legendary glints the
   dish and item icons already use. Each must read at 1× (32 CSS px) and at 0.75× and 0.5× (24 and 16 pt chips), and
   stay distinct from the Speed Ticket and the dishes in silhouette, not only in colour.
2. **Tests:** extend the items test so the ten frames exist at 32×32 and the published frames don't move.
3. **Docs:** `packages/art/README.md`, `scripts/pixel-art/README.md`, and the P-row.

## Done when

- `pnpm art:draw` runs twice with byte-identical output, and `git status` is clean after the second run.
- `pnpm lint && pnpm test && pnpm build` pass.
- The pull request shows the ten tonics inline at 1×, 2× and 4×, on a light and a dark background, beside two
  existing dish icons and the Speed Ticket.
- No original-game content.

## Deliver

- **uma-platform:** a pull request on `feat/racer-tonics`, titled `feat(art): uma-racer's tonic icons (A04)`, with a
  minor changeset and `pnpm version-packages`.
- It merges itself after green CI (P42), and the push to `main` publishes the release. Log the decision with the next
  free P-number (fetch `main` first).
- Reply with the PR link and the published version. Claude pins it in uma-racer; `ui/ItemIcon` picks the frames up
  without a code change.
