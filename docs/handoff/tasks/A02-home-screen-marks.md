# A02 — The Home screen's marks: currencies, tier crests and the Speed Ticket

**Priority: next · ChatGPT · uma-platform · S.** Ready: it can follow A01, or run beside it as its own pull request.

## Why

The account bar on uma-racer's Home screen shows three currencies: Prize Money, Speed Tickets, and Uma Tickets with
their Shards. Uma badges show a tier, 1 to 3. Today these are smooth vector icons (`apps/web/src/ui/icons/CoinIcon.tsx`,
`TicketIcon.tsx`, `UmaCouponIcon.tsx`) that clash with the pixel-art town under them. uma-art also has no Speed Ticket
item icon, so the Warehouse and the job cards borrow one.

## Context

- **uma-racer:**
  - [docs/game/11-hub-and-places.md](../../game/11-hub-and-places.md) §10.3, rows "Speed Ticket icon", "Currency
    marks" and "Tier crests";
  - `apps/web/src/hub/AccountBar.tsx`, to see where the marks sit;
  - the three icon files above, for what each mark means today.
- **uma-platform:**
  - `scripts/pixel-art/src/ui/` (the `ui` atlas: class emblems at 24×24 and status badges at 12×12; frames
    `{ x, y, w, h, group, key }`, `ui/ui.test.ts`);
  - `scripts/pixel-art/src/items/` (32×32 item icons);
  - `packages/art/README.md`.

## Do

1. **`ui` atlas, appended** so every published frame keeps its place:
   - `currency/prize-money`, 16×16: a gold coin with a small horseshoe stamped on it.
   - `currency/speed-ticket`, 16×16: a ticket stub with a lightning stroke, in teal.
   - `currency/uma-ticket`, 16×16: a gold ticket with a horseshoe cut-out.
   
   All three must read at 1× on the bar (16 CSS px) and at 2×, and stay distinct from one another in silhouette, not
   only in colour.
   - `tier/1`, `tier/2`, `tier/3`, 12×12: shield crests in bronze, silver and gold, with one, two and three pips.
2. **`items` atlas:** a `speed-ticket` icon at 32×32, the same design as the currency mark drawn at item scale, appended
   after the existing items.
3. **Tests:** extend `ui/ui.test.ts` (and the items test, if there is one) so the new frames exist at their sizes and
   the published frames don't move.
4. **Docs:** `packages/art/README.md`, `scripts/pixel-art/README.md`, and the P-row.

## Done when

- `pnpm art:draw` runs twice with byte-identical output, and `git status` is clean after the second run.
- `pnpm lint && pnpm test && pnpm build` pass.
- The pull request shows the six marks inline at 1×, 2× and 4×, on the account bar's light background and on a dark
  one, plus the Speed Ticket item beside two existing item icons.
- No original-game content.

## Deliver

- **uma-platform:** a pull request on `feat/racer-marks`, titled `feat(art): uma-racer's currency marks, tier crests
  and Speed Ticket (A02)`, with a minor changeset and `pnpm version-packages`.
- It merges itself after green CI (P42), and the push to `main` publishes the release. Log the decision with the next
  free P-number (fetch `main` first).
- Reply with the PR link and the published version. Claude pins it in uma-racer and swaps the marks in.
