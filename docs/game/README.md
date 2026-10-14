# The Uma Racer manual

What the game **is**, today. It's the reference for any session, Claude's or another agent's. Everything here
describes the code as it runs on https://uma-racer.web.app. Plans, specs and history live elsewhere (see the end).

> **Started 2026-10-14 (D337), with the re-architecture's phase 1.** The game rework ([docs/rework/](../rework/README.md))
> replaces most of today's rules when its phase 3 ships. Each page here is rewritten as the code changes, in the same
> commit, so it always describes what runs.

## Topics

| Page | Find there |
|---|---|
| [Architecture](architecture.md) | The repo, packages, web app, API, save, private content, deploy, budgets and every dependency |
| [Scenarios](scenarios.md) | The fourteen-scenario ladder, cap profiles, constellation sizes, skill point caps and buffs |
| [Racing](racing.md) | Uma Level and its EXP, what a race pays, grade handicaps and how rivals are rolled |

Looking for one thing? Search this folder first (`rg -n "handicap" docs/game`). Each page names the code it describes.

## How these pages stay true

- **Lists are generated from the code.** Each table between `<!-- live:<key> -->` and `<!-- /live -->` is rendered
  from the rules by `packages/domain/src/docs/render.ts`.
- **CI catches a stale page.** `packages/domain/src/docs/docs.test.ts` fails when a page no longer matches the code,
  so a rule change can't ship with a stale manual.
- **After a rule change, run `pnpm docs:update`.** It rewrites every live block. Commit the result with the change.
- **Hand-written parts are edited by hand,** in the same commit as the code they describe. A new list that can be
  generated gets a key in `render.ts` rather than a hand-typed table.
- **Original-game content stays out.** Only code-owned rules are rendered: no Uma, card, skill or race data from the
  private content packs.

## Elsewhere

| Where | What it is |
|---|---|
| `docs/decisions.md` | The decision log (D-numbers): why things are the way they are |
| `docs/rework/` | The game rework (D326–D336): what Uma Racer becomes. Nothing in it is built yet |
| `docs/rearchitecture/` | The rebuild on uma-platform (D321–D325) underneath the rework |
| `docs/design/` | Design specs for today's systems; some describe plans or older rules |
| `docs/technical/` | Infrastructure values, the release runbook and older architecture notes |
| `docs/tasks/` | Work that is planned or in progress |
| `AGENTS.md`, `CLAUDE.md` | How to work in this repo |
