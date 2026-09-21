# Milestone 14 — Minigames

**Outcome:** the third pillar exists. Spark Match raises Training Levels, Bond Recall limit breaks cards, and
they are good enough to want to play rather than skip.

Design: [Minigames](../design/minigames.md). Decision D120.

## Tasks

| Task | Scope | Owner |
|---|---|---|
| T049 | Spark Match — the match-3 training minigame (complete) | ChatGPT |
| T050 | Bond Recall — the match-2 card minigame (complete) | ChatGPT |

## The host port

Both minigames are built against a **port that Claude implements** in M012, so this milestone and the
constellation work proceed in parallel without touching the same files:

```ts
// apps/web/src/game/minigame-host.ts — interface and test double authored in T049,
// real implementation wired by Claude.
export interface MinigameHost {
  /** Reserves a run: spends tickets, returns the deterministic seed. Rejects if tickets are short. */
  beginRun(kind: 'spark-match' | 'bond-recall', target: RunTarget): Promise<RunTicket>
  /** Commits a finished run atomically. Safe to call twice with the same runId. */
  commitRun(runId: string, outcome: RunOutcome): Promise<RunReward>
}

export interface RunTicket { runId: string; seed: string; attemptIndex: number }
export type RunTarget =
  | { kind: 'spark-match'; umaId: string }
  | { kind: 'bond-recall'; cardId: string }
export type RunOutcome =
  | { kind: 'spark-match'; score: number; moves: number }
  | { kind: 'bond-recall'; cleared: boolean; mismatches: number }
export interface RunReward {
  ticketsSpent: number
  trainingLevelBefore?: number; trainingLevelAfter?: number; nodesUnlocked?: string[]
  limitBreakBefore?: number; limitBreakAfter?: number; couponGranted?: boolean
}
```

**Rules for both tasks:**

- Game logic is **pure and separate from rendering**, in `apps/web/src/game/minigames/`, with its own tests.
  Board generation takes the seed and returns the same board every time. No `Math.random`, anywhere.
- The minigame **never writes to the save**. It calls `beginRun` before the first interaction and `commitRun`
  once at the end. A reload mid-run restores from the seed and the run is replayable, not rerollable.
- Both are **lazy-loaded routes**. The main bundle stays ≤ 180 KB gzip; verify with `pnpm build`.
- Motion uses `m.*` under `LazyMotion strict`, animates transform and opacity only, and is delta-timed.
- Mobile first at 390×844: 44 pt targets, thumb-zone controls, `pb-safe`, no scroll during a run.
- Ship against the test double first. Do not block on the real host.

## Acceptance

- Board generation is deterministic and pinned by tests for fixed seeds.
- A full run can be played start to finish, on a phone, without a rules explanation.
- `commitRun` is idempotent: a double-commit grants one reward.
- Verified in the browser preview at 390×844, with a screenshot of each game mid-run.
