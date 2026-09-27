# T075 — One minigame shell

**Goal:** both minigames wear the same frame. Extract the shared header, start panel, result panel, gauge and guide memory
that [the Minigame kit](../design/minigame-kit.md) describes, and move Spark Match and Friendship Training onto them, so
the next minigame starts from components rather than copies.

Depends on merged T073. Read the [Minigame kit](../design/minigame-kit.md) (sections 6–9), [Visual system](../design/visual-system.md)
and both screens: `apps/web/src/screens/minigames/SparkMatchScreen.tsx` and `friendship/FriendshipTrainingScreen.tsx`.
Branch from current `main`; open a PR; never push to `main`.

## What differs today

| | Friendship Training | Spark Match |
|---|---|---|
| Back | `ChevronLeftIcon` in a 44 pt square | a text `←` in a circle |
| Buttons | `ui/Button` | raw `<button>` with local classes |
| Start | card, stakes list, **Begin · 1 ticket**, How to play | panel with rivals, TL bar, **Begin · 1 ticket** |
| Result | on the dark stage with `GainedStars` | a light `bg-panel` card on the dark stage |
| Gauges | local bars | a local `Gauge` |
| Guide memory | `guideSeen`/`rememberGuideSeen` in `FtGuide.tsx` | the same pair again in `SparkRivalGuide.tsx` |

## Scope

Add `apps/web/src/ui/minigames/` components (names are suggestions):

- `MinigameShell`: the full-screen stage (`game-surface`, `h-dvh`, safe areas, scroll locked while playing), with a
  `MinigameHeader`: back to the validated return path (`ChevronLeftIcon`), eyebrow and title, How to play (`QuestionIcon`),
  an optional headline chip (fans, wave), and optional trailing controls (deck, menu).
- `MinigameStart`: subject art, what is at stake, a short rules list, the cost button (**Begin · N tickets** / **Resume**)
  with the short-tickets state, and How to play.
- `MinigameResult`: outcome headline (cleared/lost with reason), the reward block (a slot: stars, EXP bar and crossed
  levels, opened nodes as links), and Done / Again with cost. One visual treatment on the stage for both games.
- `MinigameGauge`: label, value/maximum text and a bar, built on `ui/Meter`, colour from a token.
- `createGuideMemory(key)`: `seen()` and `remember()` over `localStorage` in try/catch; both guides use it.

Then move both screens onto them. Behaviour, copy meaning and tests stay; only the frame changes. Remove the text arrows
and raw buttons from `SparkMatchScreen.tsx`, and drop it from the glyph guard's exemption list in
`ui/icons/no-emoji.test.ts` once it passes. Fix `ui/PagedGuide.tsx`'s header comment, which cites D178 for D184.

## Tests

- Component tests for each shell piece: back link uses the return path; the cost button disables below the price and
  names the price with `formatTickets`; result renders both outcome kinds and every slot; gauge text matches its values.
- `createGuideMemory` works with storage unavailable.
- Both screens' existing tests pass unchanged apart from selectors that move to shared components.

## Acceptance

- Both minigames show the same header, start, result and gauge treatment at 390 × 844 and 375 × 667 (attach screenshots of
  each game's start, play and result).
- No raw `<button>` remains in either screen's shell; no text arrows; the glyph-guard exemption for `SparkMatchScreen.tsx`
  is gone.
- The Minigame kit's section 9 lists the new components, and its "until then copy Friendship Training" note is removed.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the main bundle stays ≤ 180 KB gzip.

## Out of scope

Game rules, balance, the Pixi board, Friendship Training's season track and scene, the journal (T076), engine location
(T077).
