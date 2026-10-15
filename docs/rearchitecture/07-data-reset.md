# 07 · Data wipe and reset

Every account starts over (D323). All player data, server and device, is deleted, not migrated. The new save
(**generation 2**) has a new local database, a new Firestore root and a new sync protocol, and a new account starts
with **20 Uma Tickets**. The owner accepts the loss of everything earned so far.

## 1. Why a new generation instead of a migration

Today a reset would have to fight the save's own protections:
- **Old saves win sync races.** A non-empty local database opens without asking the server, and a missing server
  document accepts any upsert (`save.types.ts` 1425–1432). So a wiped server is refilled by the first stale device
  that syncs.
- **The boot re-grants things.** It re-pays the seven owner-gift Uma Coupons whose ledger ids are missing (D209),
  backfills max-star coupons, settles the retired Training EXP bank and opens the Inspiration advance (D256).
- **Two explicit "preparation" flows** (Puzzles, Farm) are required before those modes work.

A clean generation sidesteps all of it. The new code can't read or write the old data, and the old code can't write
the new.

## 2. Where player data lives today, and what happens to it

| Place | What's there | After |
|---|---|---|
| **Firestore** `(default)`, `players/{uid}/{kind}/{id}` | 31 subcollections: profile, Umas, cards, badges, race results, ledger, flair, Farm, items, RPG, Puzzles, Inspiration bank, cutover and preservation rows. The parent document may not exist | **Deleted** recursively by the purge (§3). Generation 2 writes to `saves/{uid}/{kind}/{id}` |
| **API dev store** `apps/api/.data/save.json` | The local dev save, keyed by uid | Deleted; dev uses `.data/save-g2.json` |
| **IndexedDB `uma-racer`** | Dexie v34, 47 tables: every synced kind, the outbox and device-only tables (`minigameRuns`, `albumPrefs`, RPG journals and fights, Puzzle journals, archives, bases and preferences, `farmPending`, `farmRecovery` with whole-account archives, `farmPreferences`) | **Deleted** (`Dexie.delete('uma-racer')`) on first generation-2 boot |
| **IndexedDB, dev only** | `farm-kitchen-proof-*`, `puzzle-proof-*` | Deleted by name on first boot (dev builds) |
| **localStorage** | `uma-racer:` + `last-sync`, `last-content-manifest`, `scenario-choice`, `ft-partners`, `puzzle-orbs`, `puzzle-navigation-v1`, `puzzle-guide-v2`, `rpg-guide-v3`, `farm-kitchen-guide-v1`, `friendship-guide-seen`, `spark-rival-guide-seen` | Every `uma-racer:` key that isn't `uma-racer:g2:` is removed on first boot |
| **Cache Storage** | Workbox precache (the app shell); runtime cache `racer-content` (up to 4,000 content files) | The new service worker replaces the precache itself; `racer-content` is deleted on first boot. Master data then caches as `uma-content`, overlays as `racer-overlays` |
| **Memory** | Object URLs for art | Gone on reload |
| **Firebase Auth session** | The signed-in owner | **Kept**: the account is the same, only its save restarts |
| **Bucket `uma-racer-content`** | Content only, no player data | RPG files deleted ([06](06-rpg-decommission.md)). After the platform switch, master-data packs and atlases no current manifest references are deleted too |
| **Files the owner downloaded** | Puzzle backups, Farm recovery exports | Harmless; nothing can import them anymore. The owner may delete them |

## 3. The purge, run once by the app

The server-side delete runs **inside the new API, for the signed-in owner only**:
- it needs no CLI credentials on anyone's machine;
- it is path-scoped, so it can't touch the new save.

1. On its first boot, the generation-2 web app does the local wipe (§2), then calls `POST /api/legacy/purge`.
2. The API checks the owner's token as for any request. It runs Firestore's `recursiveDelete` on `players/{uid}` with
   its own service account (which already has Firestore access), writes `saves/{uid}/meta/purge` with the time and
   counts, and returns the counts.
3. Called again, from a second device or a retry, it sees the marker and returns at once.
4. The app then creates the new account's save (§5) locally and syncs it.

The endpoint and its client call are deleted in the release after the owner confirms the purge ran. The marker
document stays as a record.

> **As built (T135, [rework/13](../rework/13-removals-and-plan-changes.md) §6).** The request is exactly
> `{ protocol: 2, generation: 2 }`, and the answer is `{ status: 'purged' | 'already', at, counts: { collections,
> documents } }`. The API counts `players/{uid}`'s subcollections with `listCollections`, and counts each deleted
> document through the bulk writer that `recursiveDelete` runs on. The parent document counts only if it existed. It
> then writes the marker `{ generation: 2, at, collections, documents }` with `create()`, so two devices racing write
> one marker, and the loser answers `already` with the stored record. In dev, the local repository clears the uid's
> entry from `.data/save.json`. That path is fixed, never an env var, and is refused if it resolves to the
> generation-2 file.

For checking: Claude can list `players/` before and after with the scoped gcloud configuration
(`CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-racer`). Nothing in this plan changes the active
gcloud account.

## 4. Keeping stale devices out

A second device, or the installed app on the same phone, can still run old code until its service worker updates:

- **The server refuses old writes.** Every request carries `protocol: 2` and `generation: 2`. The API answers anything
  else with `426 Upgrade Required` and writes nothing. Old code can't recreate `players/` data, and it can't reach
  `saves/`, which it doesn't know.
- **The new client refuses old data.** It only opens `uma-racer-g2`. If the old database exists, it deletes it (§2);
  it never reads it.
- **Creates only.** In protocol v2 a missing server document accepts only a create (`baseVersion: 0`); everything else
  is a conflict ([01](01-target-architecture.md) §4.3).
- **The update reaches the device.** The service worker update is prompted as today ("Update ready — Restart"). On a
  426 the old app shows its sync error until the owner restarts it, which loads generation 2.

> **As built (T135, [rework/13](../rework/13-removals-and-plan-changes.md) §6).** `GET /api/save` carries the stamp
> as query parameters (`protocol=2&generation=2`), and the POSTs carry it in their bodies. Every route runs the auth
> guard first, so a request without a token is 401 whatever its stamp. The stamp is checked next, and the parser
> after it. The 426 body is `{ code: 'upgrade-required', protocol: 2, generation: 2 }`.

## 5. The new account

> **Revised by [rework/13](../rework/13-removals-and-plan-changes.md) §5.** A new account has 20 Uma Tickets, 0 Uma
> Shards, no per-account card state, no Card Coupons or Training Tickets, 0 Prize Money and 0 Speed Tickets, and every
> building at level 1. The table below is the first draft's.

`createInitialSave` in `@racer/domain/save`:

| Field | Value | Today |
|---|---|---|
| **Uma Tickets** | **20**, with ledger row `initial-uma-tickets` | 0 Uma Coupons, plus 7 re-granted owner gifts |
| **Umas** | **None**: the owner picks 20 from the whole roster | The 25 launch Umas, free |
| Cards | The starter card set, as today (94 cards) | Same |
| Card Coupons | 3, with ledger row `initial-card-coupons` | Same |
| Training Tickets | 0, then the first daily grant (+15, cap 60) on first boot | Same |
| Uma Shards | 0; five make one Uma Ticket, and one is earned at each gate level, as today | Same, with Uma Coupons renamed Uma Tickets |
| Featured Uma | The first Uma unlocked | A launch Uma |
| Farm, Puzzles, Items | Empty, created on first use: no preparation step | Explicit "prepare" flows |
| Owner gifts, max-coupon backfill, Training EXP bank, Inspiration advance | **Gone** | Run on every boot |

**"Uma Tickets"** is the name throughout: the profile field, ledger reasons, the account bar, the Stable. Today's
"Uma Select Coupon" is the same thing under its old name. One currency unlocks an Uma; Card Coupons stay separate for
cards.

**The first session:**
1. Sign in.
2. The app wipes and purges, then lands on the Town page with the Stable glowing.
3. In the Stable, the roster shows **20 Uma Tickets**; each unlock spends one and plays today's collection reveal.
4. The first unlock becomes the featured Uma.
5. Racing, training, the Farm and the Puzzles open as soon as there is an Uma to use them.

**Starter content moves to an overlay.** Today the racer's own packs flag 25 starter Umas and the starter cards.
Starter Umas disappear. The starter card list becomes a racer overlay (card ids) that the adapter reads
([02](02-platform-and-packages.md) §2.4), since the platform's master data is neutral.

**Dev grants.** The Settings buttons (+10 tickets; +50 tickets with 5 + 5 coupons and 10 shards; 50 Energy) are
removed from production builds and kept behind `import.meta.env.DEV` for local testing only.

## 6. Order of the cutover

All in one release (phase 3 in [08](08-phases.md)'s revised table, [M034](../tasks/M034-generation-2-cutover.md)):
1. Tag `pre-split` on today's `main`.
2. Merge the generation-2 cutover: new save, new database, protocol v2, the purge endpoint, the RPG deleted.
3. CI verifies and deploys the API and the web app together.
4. Claude checks the release with the smoke checks:
   - `/api/health` returns 200;
   - `/api/save` returns 401 without a token;
   - a protocol-1 sync returns 426.
5. The owner opens the app on the iPhone and restarts it when prompted. The first boot wipes, purges and shows 20 Uma
   Tickets.
6. Claude confirms the purge marker exists and `players/` is empty for the owner's uid. RPG and other unreferenced
   files are then deleted from the bucket.
7. The next release removes `/api/legacy/purge`.

## 7. Done when

- On the owner's iPhone, after the update, the Stable shows 20 Uma Tickets and no Umas. The Farm, Puzzles, cards and
  badges are fresh, and no screen asks to prepare, archive or recover anything.
- Firestore holds `saves/{uid}/…` only. `players/` has no documents. The purge marker records the counts.
- The device has no `uma-racer` IndexedDB, no `racer-content` cache and no `uma-racer:` keys except `uma-racer:g2:`.
- A protocol-1 request is refused with 426, and a second device that updates lands on the same new save.
- The domain package has no save migrations, and the web app has one Dexie version.
