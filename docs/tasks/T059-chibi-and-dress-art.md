# T059 — Chibi and dress art from umamusu.wiki

> Owner: Claude. **Gated on source permission** (see [Acquiring the files](#acquiring-the-files)).

## What we import

| Art | Keyed by | Per key | Source file | Size |
|---|---|---|---|---|
| **Chibi [A]** — standing | outfit (our Uma id) | 1 | `Game_Asset_petit_chr_{chara}_{dress}_0010.png` | 256² |
| **Chibi [B]** — celebrating | outfit | 1 | `Game_Asset_petit_chr_{chara}_{dress}_0011.png` | 256² |
| **Gym Clothes** | character (`charaId`) | 1 | `Game_Asset_chara_stand_{chara}_000001.png` | 512² |
| **Uniform [Summer]** | character | 1 | `Game_Asset_chara_stand_{chara}_000002.png` | 512² |
| **Uniform [Winter]** | character | 1 | `Game_Asset_chara_stand_{chara}_000005.png` | 512² |
| **Casual Outfit** | character | 1 | `Game_Asset_chara_stand_{chara}_90{chara}.png` | 512² |

Roster today: 268 outfits → **536 chibis**; 135 characters → **540 dress stands**. About 70 MB of source PNG, roughly
25 MB once encoded. The per-outfit `chara_stand_{chara}_{dress}` stand is already imported from GameTora as our 512 px
portrait, and the `0001xx` race dresses are out of scope.

## Identity: card id is not dress id

The wiki's files are named by the game's **dress id**; our Uma ids are its **card id**. They agree for 144 of 268
outfits and differ for **124**, so matching on the raw number would give nearly half the roster the wrong chibi.
Kitasan Black, for example:

| Our outfit (card id) | Dress id | Wiki caption |
|---|---|---|
| 106801 [Gilded Shrine to Glory] | 106801 | Crowning Ooban |
| 106802 [Crane's Ambition] | **106810** | Jubilant Star・Auspicious Crane |
| 106803 Final Bloom | **106802** | Final Bloom |

GameTora's `character-cards.json` (already fetched and cached by `pnpm data:import`) carries the link as `costume`.
The importer maps `card_id → costume` from that cache; **no names are matched and the content pack schema is
unchanged**. The character id is GameTora's `char_id`, equal to our `charaId`.

## Acquiring the files

The wiki is MediaWiki 1.45. Its API lists every file in two calls — `list=allimages`, `aiprefix=Game_Asset_petit_chr_`
and `Game_Asset_chara_stand_`, `aiprop=url|size|sha1|mime`, paginated by `aicontinue` — with each file's original
URL and SHA-1. **But `robots.txt` says `Disallow: /w/` for every agent, and both the API (`/w/api.php`) and the files
(`/w/images/…`) live under `/w/`.** GameTora does not host these assets. So the importer takes files one of two ways:

1. **`--source wiki-api`** — enumerate and download from the API. Runs **only with the wiki's permission**. When it
   runs: one request at a time, at least 1 s apart, a descriptive `User-Agent`, backoff on 429/5xx, and the SHA-1
   cache below, so a re-run fetches only changed files.
2. **`--source dir:<path>`** — read original files, by their wiki names, from a local folder (for example an archive
   the wiki's admins provide). Same mapping, same output.

Both feed the same selection step, so the rest of this spec does not change with the source.

## Pipeline (`scripts/assets`, run by `pnpm assets:import`)

1. **Index.** Parse each file name:
   `^Game_Asset_petit_chr_(\d{4})_(\d{6})_(0010|0011)\.png$` and
   `^Game_Asset_chara_stand_(\d{4})_(000001|000002|000005|90\d{4})\.png$`. Anything else is ignored.
2. **Select.** For each Uma in the pack, look up its dress id from `costume` and pick chibi `0010` → `a`, `0011` → `b`.
   For each distinct `charaId`, pick the four dress stands. Report what is missing, such as the newest outfits the
   wiki has not uploaded yet.
3. **Acquire.** Download into `scripts/assets/.cache/wiki/`, keyed by SHA-1, and **verify the bytes against the API's
   SHA-1**. Unchanged files are never fetched again.
4. **Encode.** `sharp` → WebP with alpha: chibis at 256 max, dresses at 512 max. Two new families beside `uma-portrait`
   and `card-art` in `art.ts`:
   `uma-chibi` (`art/chibi`, ids `{umaId}-a` / `{umaId}-b`) and `chara-dress`
   (`art/dress`, ids `{charaId}-gym|summer|winter|casual`).
5. **Write.** Content-addressed files in the gitignored `content/art/chibi/` and `content/art/dress/`, listed in
   `content/manifest.json` like the existing art.
6. **Publish.** The existing verified publisher (`pnpm content:publish -- --dry-run`, then `pnpm content:publish`)
   uploads files before the manifest into the private `uma-racer-content` bucket. Nothing enters git or a public
   host; the app reads it through the authenticated `/api/content/*` routes.

## Linking in the app

- `ArtKind` gains `'chibi' | 'dress'`. The loader, cache and hash verification are the existing ones (`useArt`).
- **Per outfit:** ``useArt(content, 'chibi', `${uma.id}-a`)`` (standing) or `-b` (celebrating).
- **Per Uma (character):** every outfit resolves the same dress art through its template's `charaId`:
  ``useArt(content, 'dress', `${uma.charaId}-winter`)``.
- A missing file falls back to the icon or nothing, never an error (D115). No save change.

## Tests

- Name parsing: every pattern above, plus lookalikes that must be ignored.
- Selection with the Kitasan Black table: 106802 must resolve to dress 106810, not 106802.
- SHA-1 mismatch rejects the file; a cached, matching file is not re-downloaded.
- Manifest round-trip for both families; the web loader resolves `chibi` and `dress` ids.

## Acceptance

- A dry run prints counts per family and every missing key, before anything is written.
- Spot check: Kitasan Black's three outfits show the right chibis; Special Week's 100102 shows dress 100130.
- `pnpm lint`, `pnpm test`, `pnpm build` green; published manifest version visible in Settings.

## Out of scope

Where the art appears. Candidates for a follow-up: Chibi [A] on Stable tiles, race select and the Home lobby;
Chibi [B] on a win, a max bond and a scenario unlock; a dress stand as a seasonal look on the profile (summer or
winter uniform by date, casual off-season, gym clothes during a Spark Match).
