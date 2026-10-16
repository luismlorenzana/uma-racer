# SD4 — uma-racer on `uma-server/auth`, `uma-kit/auth` and `uma-kit/places`

**uma-racer · Either · M · Needs: SD1 and SD2 released · Part of sibling Phase D.**

## Why

Phase D makes the screens around the game kit frames, and the API's guard a shared module:
- getting in;
- the Account;
- the Warehouse;
- the Exchange;
- the profile's frame.

uma-racer adopts them, with its own content and words.

## Context (read first)

- uma-platform: `docs/sibling/phases.md` § Phase D; `packages/kit/README.md` § `/auth`, `/places`; and
  `packages/server/README.md` § `/auth`.
- **This repo:**
  - getting in: `apps/web/src/app/boot.ts` (`bootDevice`, `bootSaveGame`), `start.ts` (`startPath`, `lastPage`),
    `UpdateNotice.tsx`; `save/boot.ts`;
  - sign-in: `auth/firebase.ts`, `auth/AuthProvider.tsx`;
  - the places: `places/account/Page.tsx` and `model.ts`; `places/warehouse/Page.tsx`, `Peek.tsx`, `model.ts`;
    `places/exchange/Page.tsx`, `Peek.tsx`, `model.ts`; `places/stable/Profile.tsx`;
  - the API: `apps/api/src/auth/auth.guard.ts`, and the API module that registers it;
  - the manual: `docs/game/11-hub-and-places.md` (the menu tree and these places).

## Decisions made

- **Web:**
  - **`BootGates`:** splash, sign-in, boot, first launch, start page. First launch is today's (a new account opens on
    the Stable's Locked tab). The start page is `startPath()`: a pending tap opens the Farm, else the last page.
  - **`AuthProvider`** from `uma-kit/auth`, with the Firebase config as `firebase.ts` reads it today.
  - **`UpdateNotice`** from the kit.
- **`AccountPage`:** rename; the wallet (Prize Money, Speed Tickets, Uma Tickets, with their marks); Appearance (from
  T147); no notifications slot, since push is off (D336); info rows; sign out.
- **Warehouse:** `ShelfView` with items and dishes, grade chips, and the stock sheet.
- **Exchange:** `ExchangeRows` for items and tickets. The Daily Purse stays a uma-racer row above them.
- **The profile:** `ProfileFrame`, with the bust, name, `formatLevel` ("T2 · Lv 13"), the tier chip, and uma-racer's
  sections as its tabs or body.
- **Unlocking:** `UnlockConfirm` for one Uma. Multi-unlock and the reveal ceremony stay uma-racer's.
- **API:** `AuthModule.forRoot({ mode, allowedEmail })` from `@luismlorenzana/uma-server/auth`, with `@Public()` on
  health. The env vars are unchanged.
- **Retired:** the replaced web files, and `apps/api/src/auth/`.

## Do

1. Pin the kit (web) and `@luismlorenzana/uma-server` (API).
2. Swap the web pieces, one place at a time. Swap the API's guard; run its tests, plus local requests (disabled mode,
   and a bad token for 401).
3. **Docs:** the manual's pages for getting in and these places, and `docs/game/architecture.md`; run
   `pnpm docs:update`; log a D-decision.
4. **Check it** in the iOS Simulator's Home Screen app, light and dark:
   - first launch on a fresh local account;
   - the start rule;
   - the Account;
   - the Warehouse and its sell sheet;
   - the Exchange and its confirm;
   - the profile;
   - unlocking one Uma.
5. **Deploy,** and ask the owner to open the app once to confirm production sign-in. Never type credentials.

## Done when

- [ ] `pnpm lint && pnpm test && pnpm build` pass; the startup budget holds.
- [ ] The retired files are gone.
- [ ] The Simulator check was done and described. The docs and D-decision are in. Deployed and green, and the owner
      confirmed sign-in.

## Deliver

- Claude: commit to `main`, `feat: getting in, Account and places on the shared kit and server (SD4)`.
- ChatGPT: branch `sib/sd4-racer-places`, a pull request with the same title.
- **Flag it done:**
  - delete this file;
  - add a Done row to `docs/handoff/README.md`;
  - set SD4 to Done in uma-platform's queue.
