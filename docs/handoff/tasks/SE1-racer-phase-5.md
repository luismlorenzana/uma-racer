# SE1 — uma-racer's phase 5: platform master data and art; its own pipeline goes

**uma-racer (with uma-platform reads) · Claude (private content, the GCP bucket, the deploy) · L · Needs: nothing ·
Unblocks: SE4, and real faces in SB6 · Part of sibling Phase E. This is the racer's own planned phase 5.**

## Why

**In progress, 2026-10-18:** the owner explicitly assigned this packet to Codex. Detailed implementation/release plan:
[M035](../../tasks/M035-platform-master-data.md), T148–T151. Protected PR workflow and local-only validation (P60).

uma-racer still imports master data and Uma art with its own GameTora pipeline, into its private content. uma-rpg
reads uma-platform's releases (`@luismlorenzana/uma-data`) through its API. The re-architecture's phase 5 moves
uma-racer onto the same releases and art families and deletes its pipeline. Then both games read the same data, art
(including SB1's `outfit-faces`), and shared loading code (SE2, SE4).

## Context (read first)

- **This repo's plan:**
  - `docs/rearchitecture/08-phases.md`, phase 5, and the rest of `docs/rearchitecture/` it links;
  - `docs/tasks/README.md` (phase 5 is "Planned, specified in turn");
  - `docs/game/architecture.md` (content today).
- **uma-platform:**
  - `docs/racer-mapping.md`: how racer's content kinds map to uma-data's art families and ids. It's the spec for this
    move.
  - `docs/master-data.md`: releases, channels, the art index, how a game's API reads the bucket.
  - `README.md` § "Use `@luismlorenzana/uma-data` in a game".
- **uma-rpg as the working example:**
  - its API's `apps/api/src/master/` (the bucket or local source, the controller);
  - its web's `apps/web/src/master/master.ts` (the release client) and `art.tsx` (images by family);
  - its infrastructure doc (the service account that reads the master data bucket).
- **This repo's content today:**
  - `apps/web/src/content/*` (`runtime.ts`: `ArtKind` uma, card, bust, chibi, dress, face);
  - `apps/web/src/app/content.ts`;
  - `apps/api/src/content/*`;
  - `scripts/` (the GameTora importer to delete);
  - the private bucket and `content/` (gitignored).

## Decisions made

- **Data:** every master data read goes through uma-data's release client and the API's proxy, `/api/master/` as in
  uma-rpg. Content ids map per `racer-mapping.md`. Outfit ids are the same numbers.
- **Art:** Umas, cards, busts, chibis, dresses and faces come from uma-data's families (`outfit-icons`,
  `outfit-busts`, `outfit-chibis`, `character-faces`, and `outfit-faces` once SB1 publishes it). Racer-only content
  that uma-data lacks stays a private pack, behind an allowlist, as uma-rpg's enemy packs are.
- **The pipeline goes:** the GameTora importer, its scripts and its bucket objects (after a successful deploy reads
  the new source). The owner doesn't need backups of it: uma-platform's release replaces it.
- **Infrastructure:** grant uma-racer's API service account read access to uma-platform's master data bucket, as
  uma-rpg's has. Scope every `gcloud` command with this repo's documented config. Never change the active gcloud
  account.
- **Saves don't change:** ids are the same numbers. If any stored id differs, migrate on read and note it.

## Do

1. **Specify** phase 5 in `docs/tasks/` as this repo does: an M-task with T-tasks, taking the next free numbers in
   `docs/tasks/README.md`. Link it from here; this packet is the brief.
2. **API:** a master data source (bucket in production, `../uma-platform/content/release` locally) and `/api/master/`,
   on the pattern of uma-rpg's `apps/api/src/master/`. If SE2 has landed, use `uma-server/content` instead.
3. **Web:** load the release with uma-data's client, and map it to the game's content shapes through one adapter.
   Switch art to uma-data's families.
4. **Infrastructure:** the bucket read grant, documented in this repo's infrastructure page, with a cost note:
   storage reads within the free tier.
5. **Delete** the GameTora pipeline, the old content runtime paths and their tests. Then remove the retired bucket
   objects after the deploy is verified.
6. **Docs:**
   - `docs/game/architecture.md`;
   - `docs/rearchitecture/08-phases.md` (phase 5 done);
   - `docs/tasks/README.md` (the phase table);
   - uma-platform's `docs/racer-mapping.md`, if any mapping changed (a one-line note through the queue).
7. **Check it** locally, in the game's dev server (a desktop browser at phone width; no iOS Simulator, P60):
   - the Stable's art;
   - the plaza's chibis;
   - the profile's bust;
   - a race;
   - the Farm's items;
   - a cold start offline (the art comes from cache).

## Done when

- [ ] `pnpm lint && pnpm test && pnpm build` pass; the startup budget holds.
- [ ] No code reads the GameTora pipeline's output. `scripts/`' importer is gone.
- [ ] Production reads uma-platform's release: `/api/master/` serves the `latest` channel, checked on the deployed API.
- [ ] The local check was done and described. The docs and D-decisions are in. Deployed and green.

## Deliver

- Claude: commit to `main` in the task's steps (one commit per part, one push and deploy at the end, per
  `CLAUDE.md`).
- **Flag it done:**
  - delete this file;
  - add a Done row to `docs/handoff/README.md`;
  - set SE1 to Done in uma-platform's queue.
