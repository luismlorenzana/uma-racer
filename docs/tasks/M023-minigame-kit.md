# Milestone 23 — Minigame kit

**Outcome:** the two minigames share one engine home, one saved-run format and one screen frame, so a third minigame starts
from the [Minigame kit](../design/minigame-kit.md) instead of copying either game. No rule, number or reward changes.

Decision: D185. Source of truth: [Minigame kit](../design/minigame-kit.md). Owner: Codex.

| Task | Delivery | Order |
|---|---|---|
| T077 (complete) | Spark's and Friendship Training's rules moved to `packages/domain/src/minigames/<id>/`, byte-identical replays | first |
| T076 (complete) | One engine-agnostic journal port; Friendship Training moved onto the replay journal and a replayed commit | second |
| [T075](T075-minigame-shell.md) | A shared header, start panel, result panel, gauge and guide memory, used by both games | third |

Run M023 after T074's balance pass and before T074's feedback, accessibility and device closure, so that polish lands on
the shared shell. The PRs are sequential; each is a refactor that keeps every existing test green and every replay hash
identical.

When T075 lands, the kit's remaining temporary shell notes come out, its tables name the final components, and this
milestone spec plus T075 are removed under D104.
