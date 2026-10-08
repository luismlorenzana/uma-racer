# T117 — Puzzle setup parity with the RPG: ten parties, a free-Uma picker, level-first roster and profile hops

**Outcome:** Uma Puzzles' setup screens (Hub, Roster, Profile, Party editor, Chapters) work the way the owner asked
the Uma RPG's to work on 2026-10-08 (D284). Moving between the two modes feels like one game. The owner should not
have to re-learn party building, and none of their earlier corrections should come back in the new mode.

**Prerequisite:** T116 has merged (`b31b0a2`). Start from the latest `main`, on a `feat/…` branch, and open a PR
(AGENTS.md). Do not change RPG behavior.

Read first:

- [Uma Puzzles §4 Parties](../design/uma-puzzles.md#parties) and [§9 Screens](../design/uma-puzzles.md#9-screens-guides-and-visual-identity).
- [T112 setup navigation](../technical/uma-puzzles-implementation.md#t112-implemented-setup-navigation-d275).
- The RPG's [Phone presentation](../design/uma-rpg.md) section and decision **D284** in [decisions.md](../decisions.md).
- The RPG reference code: `apps/web/src/screens/rpg/RpgScreen.tsx` (`RpgHubScreen`, `RpgRosterScreen`,
  `RpgProfileScreen`, `RpgPartyEditScreen`) and `apps/web/src/ui/rpg/roster-options.ts`.

## Why: the review behind this task

Claude reviewed the T116 release against the RPG's later setup changes (D284). It looked at the code and at the T112
and T116 phone screenshots in `docs/research/puzzle-navigation/` and `docs/research/puzzle-release/`. The battle,
campaign, economy and preservation work is out of scope here; the gaps are all in setup and selection.

| Area | RPG today (D284) | Puzzles today | Gap |
|---|---|---|---|
| Party count | Ten parties (`RPG_PRESET_COUNT = 10`) | Five (`PUZZLE_PARTY_IDS`, `/^puzzle-party-[1-5]$/` in domain and the API mirror) | Raise to ten |
| Member picker contents | Enrolled Umas that **no** party holds | Unassigned outfits by default, plus a **"Move from another party"** mode (`puzzlePicker(…, true)`) | Drop the move mode |
| Picker order and labels | Highest level first, then name; name and level under each icon | `account.outfits` order; 9 px name only | Sort and caption |
| Filled slot | **Swap** and **Remove** on every slot card | Remove only; to swap you must Remove, then Add | Add Swap |
| Party → profile | Slot portrait and name link to `/rpg/roster/:id?party=…` | No link; slots only select within the editor | Link them |
| Profile from a party | Five-member strip, one tap apart; back returns to the party with its name | Back always goes to Roster; a generic "Back to parties" link | Add strip and party back |
| Roster order | Enrolled, then **level, highest first**, then name (`orderRpgRoster`) | Enrolled, then **name** (`puzzleRoster` sort) | Level first |
| Roster grouping | "Enrolled · N" / "Not enrolled · N" sections | One grid and a sentence | Add sections |
| Dropdowns | The owner asked for no dropdown when choosing members | Native `<select>` (`PuzzleSelect`) used for: roster Element and Style filters, the party Leader, kit Active and Pattern, and the **Party** on Chapters | Replace with tappable chips or option rows |
| Party that isn't full on Hub | Card links to **Edit** ("fill every slot") | Primary button says **Choose chapter**, which opens Chapters with every button disabled | Point to Edit |
| First use | Hub card "Start by enrolling Umas in the Roster" plus **Open Roster**; picker empty state links to Roster | No Hub empty state; picker empty text has no link | Add both. Nothing is auto-enrolled, so this is the owner's first screen |

These items are smaller, in the same files:

- The profile shows the element in lowercase ("fire · Element locked"), and EXP as text with no bar.
- The map's back button goes to the Hub, not to that party's chapters.
- The "Unknown party preset. Return to your five parties." and Hub "Five independent journeys…" copy is now wrong.

## Fixed choices (decided; don't reopen them)

1. **Ten Puzzle parties**, `puzzle-party-1` … `puzzle-party-10`, for the same reason the RPG went to ten. Each party is
   its own row, so existing five-party saves load unchanged, and parties 6–10 appear empty (`emptyPuzzleParty`,
   named "Party 6" … "Party 10"). No save schema bump and no migration.
2. **The member picker offers only enrolled outfits that no Puzzle party holds**, highest Puzzle Level first, then
   name, then id.
   - **Remove the "Move from another party" mode and its confirmation from the UI.** The empty state says to
     remove her from her other party first and links to the Roster, word for word like the RPG.
   - Keep `host.transfer` and its protocol and tests. It is part of the saved-operation contract; only the UI entry
     goes. Say so in the decision.
3. **Every slot has Add, Swap and Remove.** Swap replaces the member in place, in the same slot and leader position.
   The incoming outfit brings her own default kit, as a new assignment does today.
4. **Party editor layout follows the RPG:** a vertical card per slot.
   - Each card has her portrait (a link to her profile), her name with a chevron (same link), "PL n · Element", and
     Swap and Remove (or Add when empty).
   - Her kit options sit inline, under the card.
   - Keep the leader mark on slot 1 and the move-left and move-right controls. Leader order matters here and not in
     the RPG.
   - Party leader skill and colour coverage and stats stay as they are, minus the dropdowns (see 6).
5. **Profile opened from a party** (`/puzzles/roster/:outfitId?party=puzzle-party-n`, used only by party-editor
   links):
   - A five-member strip at the top: the current member ringed, the others dimmed, each linking with the same
     `?party=`.
   - The header back button returns to `/puzzles/party/:partyId` and reads as the party name. Add a `backLabel` prop
     to `PuzzleFrame` instead of inferring the label from the path.
   - From the Roster, the profile behaves as today.
6. **No dropdowns for any Puzzle choice.** Replace every `PuzzleSelect` with tappable controls, each at least 44 pt:
   - Roster filters: one compact, horizontally scrollable chip row. All, the five element marks, and the four
     original-A styles.
   - Leader skill (3 options), kit Active (1–4) and Pattern ("None" plus up to 2): option rows or chips with the full
     label. Follow the RPG's skill and Familiar chips (`SlotLoadout`).
   - Chapters: replace the Party dropdown with a party chip row (name and `filled/5`). The selected chip writes the
     same navigation memory.

   Then delete `PuzzleSelect` if nothing uses it.
7. **Roster:**
   - Sections "Enrolled · N" and "Not enrolled · N". Unavailable entries go last within Not enrolled.
   - Inside each section: Puzzle Level, highest first, then name, then id.
   - Captions under each icon: name, then "PL n", "Enroll" or "Unavailable".
   - Filters keep their current meaning.
8. **Hub:**
   - A party that isn't full: its primary action is **Fill party**, opening the editor.
   - With no enrolled outfits, a first card says "Start by enrolling Umas in the Roster" with **Open Roster**, above
     the parties.
   - Copy changes to "Ten independent journeys…".
   - The Constellation bank panel keeps its content but moves **below** the parties, so parties are the first thing
     on the screen.

## Implementation contract

**Ten parties: domain, API mirror and client**

- `packages/domain/src/minigames/uma-puzzles/records.ts`: `PUZZLE_PARTY_IDS` gets ten ids. Change every
  `/^puzzle-party-[1-5]$/` to `/^puzzle-party-([1-9]|10)$/`; today they are in `battle-parse.ts`,
  `campaign/progress.ts` and `campaign/identity.ts`.
- Make the **same** changes in the API mirror under `apps/api/src/save/puzzle-domain/minigames/uma-puzzles/`.
  `apps/api/src/save/puzzles.ts` validates through that mirror; confirm nothing else hard-codes five.
- The client, API and server must agree, so the PR ships them together. A web build that can write `puzzle-party-6`
  must never reach an API that rejects it.
- **Check the sync limits with ten parties. This is the one real risk.** In `operations.ts`,
  `puzzleOperationReferences`:
  - The `party()` helper adds every `puzzlePresets/*` plus that party's 14 `puzzleCheckpoints`.
  - `correct` and `equip-outfit` call it for **every** party: about 78 references with five parties, about 153 with
    ten.
  - The batch parser rejects a batch whose combined references exceed `PUZZLE_SYNC_LIMITS.documents` (200).

  So one element correction or default-kit edit, batched with almost anything else, can now overflow. Fix it:
  - Make `correct` and `equip-outfit` reference only the parties that hold that outfit, plus all presets for the
    uniqueness read, instead of every party's checkpoints.
  - Or have the client split batches by reference count.

  Keep the server check authoritative and don't raise the limit. Add tests that build the worst cases and assert
  they parse:
  - Ten full parties, the outfit in one of them, with a correct or equip-outfit operation batched beside a save-party.
  - A transfer between two parties.
- `apps/web/src/game/puzzles/host.ts` already fills missing parties from `PUZZLE_PARTY_IDS`.
  `apps/web/src/game/puzzles/navigation.ts` and `screens/puzzles/ui-proof-data.ts` iterate it; verify both.

**Shared ordering**

- Add `puzzleRosterOrder` and `puzzlePartyCandidates` in `apps/web/src/game/puzzles/presentation.ts`, mirroring the
  RPG's `orderRpgRoster` and `rpgPartyCandidates`.
- Don't import RPG modules into Puzzles, and don't change the RPG helpers.
- `puzzlePicker` loses its `transfer` parameter, or it is no longer called with `true` from the UI.

**Screens**

- `PuzzlePartyScreen`, `PuzzleRosterScreen` (roster and profile), `PuzzleHubScreen`, `PuzzleChaptersScreen`,
  `PuzzleMapScreen` (back goes to `${root}/chapters?party=${partyId}`) and `ui/puzzles/kit.tsx` and
  `components.tsx`.
- Keep every guard that exists today:
  - An open battle locks the party's members, kit and leader.
  - Revision-checked `host.saveParty`, and the operation-id retry through `command`.
  - Element lock on first entry.
  - 44 pt targets and safe areas at 390×844 and 375×667.
- Small profile fixes:
  - Capitalize element names.
  - Add an EXP bar under "Puzzle Level n", in the RPG profile's `RpgBar` style. Reuse or copy it within the Puzzle
    UI; don't import from RPG screens.
  - Show "In {party name}" when she is in a party.
- Copy: "five parties" becomes "ten parties" everywhere (UI, guide, design doc §4 and §9). "Five Umas per party"
  stays.

**Docs** (same PR)

- `docs/design/uma-puzzles.md`: §4 Parties (ten parties; free-only picker; Swap; no cross-party move in the UI) and
  §9 (roster order and sections, chip filters, party editor cards, profile strip, Hub first-use card, no dropdowns).
- `docs/technical/uma-puzzles-implementation.md`: party ids and regex, sync-limit evidence, transfer UI removal.
- `docs/decisions.md`: append the next free decision (**D291** unless taken by then): "Puzzle setup follows the
  RPG's D284…". Give the reason: the owner's D284 requests apply to both modes.
- Delete this spec and update `docs/tasks/README.md` (D104).

## Tests

- **Domain and API:**
  - `puzzle-party-10` parses everywhere `puzzle-party-5` does.
  - `puzzle-party-11` and `puzzle-party-0` are rejected.
  - The API mirror has the same assertions.
  - The worst-case ten-party operation stays within `PUZZLE_SYNC_LIMITS`.
- **Host:**
  - A save holding parties 1–5 loads ten parties, 6–10 empty and named "Party 6…10". Nothing changes on disk until
    one of them is edited.
  - Saving party 10 round-trips through the real host in the isolated IndexedDB harness.
- **Presentation:**
  - Roster order: enrolled first, PL descending, then name, then id; unavailable entries last.
  - The picker excludes members of any party, including this party's other slots, and is ordered by PL.
- **Screens** (Testing Library, synthetic data only):
  - The picker shows no "Move from another party" control, and its empty state links to the Roster.
  - Swap replaces in place: same slot index; slot 1 keeps the leader mark.
  - A slot links to `/puzzles/roster/:id?party=…`. That profile renders five strip links, and its back target is the
    party editor, labelled with the party name.
  - The Hub shows Fill party for a partial party and the first-use card when nothing is enrolled.
  - There is no `<select>` in any Puzzle screen. Assert `container.querySelector('select') === null` for Roster,
    Party, Chapters and Profile.
- Existing Puzzle tests stay green with no thresholds loosened. RPG tests are untouched and green.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass. The startup bundle stays within 180 KB gzip; Puzzle chunks stay lazy.
- Phone screenshots from the isolated DEV proof (synthetic data, original placeholders), at 390×844 and 375×667,
  checked into `docs/research/puzzle-setup-parity/`:
  - Roster with sections and chip filters
  - Party editor slot cards
  - Picker sheet (filled and empty)
  - Profile with the party strip
  - Hub with ten parties and a first-use card
  - Chapters with party chips
- No private content, owner save or account JSON in git. No production infrastructure changes.
- The PR describes what was verified and what wasn't: owner iPhone checks stay with the
  [release acceptance protocol](../research/uma-puzzles-release-acceptance.md#owner-productioniphone-protocol).
- This spec is deleted in the same PR (D104).

## Out of scope

- The battle engine, board, Pixi scene, encounter recipes and D290 tuning.
- Campaign map rules, rewards, the material economy, exchange, the CL spend sheet.
- Preservation, backup, readiness gates and release flags.
- Enrollment rules and element eligibility. Kit and leader rules stay the same; only their controls change.
- The T109 art upgrade.
- Any RPG code or behavior.
