# T135 — The API on generation 2

**M034 · after T134, in parallel with T136 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md). Its fixed choices bind this task: the module
  is built in `apps/api/src/save-g2/` and stays out of `AppModule` until T143; the server is the authority.
- The [T134 spec](T134-generation-2-save.md): every row, wire type, parser, bound and `commitOperation` this task calls.
- [rearchitecture/01](../rearchitecture/01-target-architecture.md) §4.3 and §6, [rearchitecture/07](../rearchitecture/07-data-reset.md)
  (all: the purge, stale devices, creates only), [rework/13](../rework/13-removals-and-plan-changes.md) §6,
  [rework/02](../rework/02-check-ins-and-notifications.md) §8–§9 and [rework/09](../rework/09-racing-rewards-and-exchange.md) §8.
- Today's API, to learn from and not to reuse: `save/save.controller.ts`, `save/firestore-save.repository.ts` (one
  transaction, reads before writes), `save/local-save.repository.ts` (an atomic file, serialized calls),
  `save/firestore-codec.ts`, `save.types.ts`'s `resolveUpserts` (versions), `save/save.test.ts`, the fake Firestore in
  `save/rpg-command.test.ts`, `auth/auth.guard.ts` and `content/content.service.ts` (`readVerifiedJson`). Keep those
  patterns. Drop every lane, preparation, cutover and migration.
- uma-rpg's `apps/api/src/save/*` on `origin/main`, read only: one repository interface with two implementations.

## Goal and fixed scope

The API keeps generation 2 under `saves/{uid}` and is its authority. It re-runs every operation with the domain, so
the device's numbers and the server's come from one function.

1. **Three routes, all behind `AuthGuard`** (rearchitecture/01 §6, 07 §3): `GET /api/save`, `POST /api/sync` and
   `POST /api/legacy/purge`. `/api/health` is untouched.
2. **426 for anything but protocol 2 and generation 2**, with nothing read or written (07 §4). An old installed app
   can't write, and can't recreate `players/`.
3. **Operations re-run on the stored save** with T134's `commitOperation` and the content they need. A refusal comes
   back with the same plain words, and a retried id gets its first receipt and is never applied twice (02 §9).
4. **A missing document accepts only a create** (rearchitecture/01 §4.3).
5. **The purge** (07 §3): `recursiveDelete` of `players/{uid}`, the marker `saves/{uid}/meta/purge` with the time and
   counts, idempotent, for the signed-in owner only.
6. **Built beside.** Today's `save/` module keeps serving today's game until T143 mounts this one and deletes it.

## Implementation contract

**Files** in `apps/api/src/save-g2/`: `save-g2.module.ts`, `save-g2.controller.ts`, `save-g2.repository.ts` (the
interface and `SAVE_G2_REPOSITORY`), `resolve.ts` (pure), `firestore-save-g2.repository.ts`,
`local-save-g2.repository.ts`, `operation-content.ts`, and tests beside them.

**The module** follows `SaveModule`. It provides `AuthGuard` and a repository factory: `PERSISTENCE=firestore` gives
the Firestore repository, anything else the local one at `LOCAL_SAVE_FILE`, whose default here is `.data/save-g2.json`
(T143 sets the variable to that path). It builds a `ContentService` from the config, as `SaveModule` does. `AppModule`
does not import it.

**The controller** is `@UseGuards(AuthGuard) @Controller()`. Each route runs the guard first, then the stamp, then the
parser:
- `GET save`, with the query `protocol`, `generation`, `since` (whole ms, default 0) and `cursor`, returns
  `SaveSnapshotV2` from `repository.snapshot(uid, since, cursor)`.
- `POST sync`, with a `SyncRequestV2` body, returns `SyncResponseV2`. A body T134's parser refuses is 400. With no
  save and no create it is 409 `{ code: 'no-save' }`. When an operation needs content that can't load, it is 503
  `{ code: 'content-unavailable' }`, and nothing is written.
- `POST legacy/purge`, with exactly `{ protocol: 2, generation: 2 }`, returns `PurgeResponse`.
- A wrong or missing stamp is `new HttpException({ code: 'upgrade-required', protocol: 2, generation: 2 }, 426)`.

**The repository interface:** `snapshot(uid, since, cursor)`, `sync(uid, request, env)` and `purge(uid)`. `env` is a
function that loads the operation env once, called only when the request holds an operation.

**`resolve.ts`** is pure and shared by both repositories, so most tests drive it directly.
- `syncReadSet(request)`. A request with a create or an operation reads the **operation set**: every row of
  `profile`, `umas`, `buildings`, `work` and `items`; the `ledger` rows whose reason is in T134's
  `RULE_LEDGER_REASONS`; and `operations/{id}` for the request's operation ids. Every request also reads the
  `badges` and `flairEvents` documents it names. Nothing else is read.
- `resolveSync(stored, request, now, env)` returns `{ response, entities, logs }`, or `NO_SAVE` when there is no
  `profile/main` and the first change isn't a create. It walks the changes in order on one in-memory state:
  - **create:** `exists` if the profile is there. Otherwise T134's `initialSave(createdAt)` rows, and `created`;
  - **badge upsert:** a missing document with `baseVersion` 0 is written at version 1. A missing one with a higher
    base is a `conflict` with no copy. A matching version is written at version + 1. Anything else is a `conflict`
    with the server's copy;
  - **flair append:** `exists` if the row is there, else `appended`;
  - **operation:** `OPERATION_INPUTS` refuses the input, or `commitOperation` throws: `invalid`, and the walk goes on.
    Otherwise `refused` with its refusal, `repeated` with the first receipt, or `applied`, which carries the new state
    to the next change.
- Writes are coalesced to one per document, with its final data. An entity gets the stored version + 1, or 1 when
  new, once per sync. Every written row gets `savedAt = now`. A log row is written only if absent.
- The response's `entities` are the written rows and each conflict's copy, plus every entity after `exists`. Its
  `logs` are the written log rows. A `repeated` operation writes nothing; the device's next pull brings any rows it
  missed.
- `snapshotPage(rows, since, cursor, now)` takes rows with `savedAt > since`, and for `operations` with `savedAt` after
  both `since` and `now − OPERATIONS_WINDOW_MS`. Rows go in `KIND_ORDER`, then by `savedAt`, then by id, within
  T134's page bounds. The cursor encodes the kind, `savedAt` and id of the page's last row.

**The Firestore repository.**
- **Layout:** `saves/{uid}/{kind}/{id}`. Rows are stored through today's `toStored`/`fromStored` codec: a work row's
  arrays of arrays become `dataJson` (D151). The codec is imported from `../save/firestore-codec`, and T143 moves it.
- **Sync** is one `runTransaction`: every read of the read set (collections through `tx.get` of a query, documents
  through `tx.getAll`), then `resolveSync`, then every `set`. There is no read after the first write. A thrown error
  writes nothing.
- **Snapshot** runs, per kind, `where('savedAt', '>', since)`, ordered by `savedAt` and then document id, from the
  cursor, with a limit. It is not a transaction.
- **Purge:**
  1. Read `saves/{uid}/meta/purge`. If it exists, answer `already` with its time and counts.
  2. Count `players/{uid}`'s subcollections with `listCollections`.
  3. Run `recursiveDelete(players/{uid}, bulkWriter)`, counting documents with the writer's `onWriteResult`.
  4. `create()` the marker `{ generation: 2, at, collections, documents }`. If another call wrote it first, answer
     `already` with the stored marker.

  Nothing under `saves/` is touched but the marker. `meta` is not a save kind, so no snapshot returns it.
- The constructor takes an injected Firestore for tests, as today's does.

**The local repository** writes `.data/save-g2.json`, shaped `{ [uid]: { rows: { 'kind/id': row }, purge? } }`. It uses
today's pattern, a temporary file then a rename, with calls serialized in-process, and runs `resolveSync` and
`snapshotPage`. Its purge removes `[uid]` from the old dev file, the fixed path `LEGACY_LOCAL_SAVE_FILE`
(`.data/save.json`), if it is there, counting its rows by kind, and then writes the marker. It throws if that path
resolves to the generation-2 file.

**`operation-content.ts`** loads what `OPERATIONS` reads:
- From `ContentService.manifest()` it takes the `umas`, `races`, `cards` and `skills` packs, one each, by the web's
  patterns (`data/<pack>.<8 hex>.json`). It reads each with `readVerifiedJson`.
- It checks `{ version, items[] }` with unique ids, as the web's `parseContentPack` does, and builds the env with
  T134's `buildOperationEnv`.
- The env is cached per manifest version, and the manifest is re-read at most once a minute.
- A missing or failed pack is `ContentUnavailable`, which the controller turns into 503. No path, row or private value
  reaches a log or a response.

**Errors.** 400 messages are developer text and never reach a screen; T136 turns every status into plain words.

## Tests

Synthetic data only. A fake Firestore extends `rpg-command.test.ts`'s with queries, `create`, `listCollections`,
`recursiveDelete` and a bulk writer. The local repository runs in a temporary directory.
- **Stamps.** `GET`, `sync` and `purge` with no stamp, protocol 1 or generation 3 answer 426, and the fake records no
  read or write. A missing token is still 401 first.
- **Guard.** Every route of the controller carries `AuthGuard` (`Reflect.getMetadata('__guards__', …)`).
- **The new account.** A create writes 20 Uma Tickets, 14 buildings at version 1 and the ledger row. A second create
  answers `exists` with every entity.
- **Operations.** Two `unlock-uma` leave 18 tickets, with the first as featured Uma. The same id again is `repeated`
  with an identical receipt, and writes nothing. A 21st unlock is `refused` with its plain words, and nothing is
  written. A malformed input is `invalid`, and the next operation still applies. A batch of unlock, start and collect
  applies in order, and each document's version rises once.
- **Two devices.** Device A collects; device B's later Collect all returns the server's receipt without A's items
  (02 §9, "Already collected"). A phone clock moved forward finishes work, and its collect is accepted (02 §12).
- **Rows.** The badge create, match, stale and missing-with-a-base cases. A flair event's first write wins. A
  `profile` or `umas` upsert, and each T134 bound, are 400. No save and no create is 409.
- **Content.** A missing pack makes an operation 503 with nothing written, while a badge-only sync still applies.
- **Atomicity.** A failure at commit in the fake transaction writes nothing.
- **Snapshot.** Kind order, a resumed cursor, the `since` filter, the week of operations, and the page bounds.
- **Codec.** A work row with nested arrays round-trips through Firestore.
- **Purge.** It deletes the fake `players/{uid}` tree, counts it, writes the marker, and leaves `saves/` alone. A
  second call answers `already` without deleting anything. The local variant does the same with the old dev file.
- **Parity.** The local and Firestore repositories give the same responses for one scripted day.

**Dev operations.** The env passed to `commitOperation` carries `dev: process.env.DEV_OPERATIONS === 'true'`, so T134's `dev-grant` runs only on a dev API (the rehearsal) and is refused everywhere else. The deploy workflow never sets it, and a test pins the refusal with the variable unset (M034).

## Acceptance

- [ ] `apps/api/src/save-g2/` holds this module; `AppModule` and today's `save/` are unchanged, and their tests pass.
- [ ] Every route is behind `AuthGuard`, and every stamp other than 2 and 2 answers 426.
- [ ] `pnpm lint && pnpm test && pnpm build` are green.
- [ ] The Decided here rows go into rework/13 §8 (the stamps and the purge also into rearchitecture/07 §3–§4), with
      one decisions.md entry, and this spec is deleted (D104).

## Out of scope

Mounting the module and deleting today's save module and endpoints (T143). The release's smoke checks, the purge's
verification and the bucket cleanup (T144). Removing `/api/legacy/purge`, in the release after the owner confirms it
ran (07 §6). Master data (phase 5) and push (phase 4).

## Decided here

| Choice | Why |
|---|---|
| `GET` carries its stamp as query parameters; the POSTs carry it in the body | 07 §4 stamps every request, and a GET has no body |
| The guard runs before the stamp | The release's smoke check expects 401 without a token (07 §6) |
| A malformed operation input is that operation's `invalid`; a malformed request is a 400 | One bad tap never blocks the outbox behind it, and a broken request is a client bug |
| 409 only for a missing save; per-change conflicts come in a 200 | Today's pattern: one answer accounts for every change |
| 503 when content can't load, and only for requests with operations | No operation runs without its rules' content, and badges never need it |
| One version bump per document per sync | Several operations on one Uma in one batch are one write |
| An operation request reads the whole operation set | Collect all and Repeat read every Uma. At 25 Umas a sync is about 200 reads, so even 100 syncs a day stay under the free tier's 50,000 |
| The server runs on its current content, not the device's version | Server authority; the device adopts the server's rows |
| The purge counts with `listCollections` and the bulk writer, and writes its marker with `create()` | Exact counts, and two devices racing write one marker |
| The local purge clears the old dev file's entry for the uid, at a fixed path, never an env var | 07 §2: the dev store is deleted, and dev uses `.data/save-g2.json`. T143 points `LOCAL_SAVE_FILE` at the new file, so the old one can't share the variable |
| Content is cached per manifest version, re-read at most once a minute | One bucket read a minute at most, and a publish takes effect within a minute |
