# Handoff: packets for ChatGPT

Self-contained tasks that a ChatGPT (or Codex) session can take without this conversation's context, one pull request
each. Start a fresh session with [master-prompt.md](master-prompt.md). A packet is deleted once its work merges (D104),
so `tasks/` only holds work still ahead.

## How a packet reads

Each packet stands alone:
- **Why:** the reason for the work.
- **Context:** what to read, and what already exists.
- **Do:** the work, with the design decisions already made.
- **Done when:** checks anyone can run.
- **Deliver:** the branch, the pull request, and what to attach.

The art packets follow uma-rpg's delivered precedent: H01's calibration (its D90) and H28's gear icons. The art is
drawn from code in uma-platform's `scripts/pixel-art` and published as `@luismlorenzana/uma-art`. uma-racer pins the
release afterwards; Claude does that side.

## Sibling packets (any worker), 2026-10-16

The sibling apps plan's phases B to E, broken into self-contained packets by uma-platform's session (its P51). This
repo's packets are below. The whole program, across uma-platform, uma-rpg and uma-racer, with its parallel tracks, is
uma-platform's [queue](https://github.com/luismlorenzana/uma-platform/blob/main/docs/handoff/README.md).
- Any worker, a Claude session or ChatGPT, starts with uma-platform's
  [master prompt](https://github.com/luismlorenzana/uma-platform/blob/main/docs/handoff/master-prompt.md) and a packet
  id ("Take SA7").
- A Claude session commits to `main` as `CLAUDE.md` says. ChatGPT uses a branch and a pull request, as `AGENTS.md`
  says.
- The worker flags its packet done: it deletes the file, adds a Done row here, and sets the State in uma-platform's
  queue.

| Id | Task | Who | Size | Needs | State |
|---|---|---|---|---|---|
| [SE1](tasks/SE1-racer-phase-5.md) | Phase 5: uma-platform's master data and art; the GameTora pipeline goes | Claude | L | — | Ready |
| [SC5](tasks/SC5-racer-on-uma-work.md) | Work on `@luismlorenzana/uma-work` and `uma-kit/work` | Either | L | SC1, SC2 | Waiting |
| [SE4](tasks/SE4-racer-content.md) | Data and art through `uma-kit/content` and `uma-server/content` | Either | M | SE1, SE2 | Waiting |

**Done (sibling packets)**

| Id | Task | Commit |
|---|---|---|
| SA7 | The plaza crowd: small chibis on Town Hall (uma-kit 0.3.0, D371) | `9723a23` |
| SD4 | Getting in, Account, Warehouse, Exchange and the profile on uma-kit 0.6.0; the API's guard from uma-server 0.2.0 (D372) | `7d2b757` |
| SB6 | Shared Stable and every Uma picker on uma-kit 0.7.1; faces when small, busts in races (D373). [Local acceptance and successful deployment](../research/sb6-album/README.md); phone edges are the owner's check (P60) | `4885baf` ([PR #120](https://github.com/luismlorenzana/uma-racer/pull/120)) |

## For ChatGPT, in order

1. [A04](tasks/A04-tonic-icons.md): the ten tonics' 32×32 item icons in uma-art's `items` atlas (D374). Ready.

The owner authorized A03's implementation, merge and deployment in chat; its proof records the checks and pending
device acceptance. The shared shell remains uma-kit's (T147, D367), not a local fork.

| Done | What | Landed |
|---|---|---|
| A03 | Farm, Training, Lineage and Racing pickers open on level; context sorts and Open goals stay optional | D368; [07](../game/07-farm.md) §10, [05](../game/05-training-hub.md) §8, [11](../game/11-hub-and-places.md) §9.2; [synthetic phone proof](../research/a03-level-rule/README.md). Last packet: `652cc58:docs/handoff/tasks/A03-iphone-band-and-level-rule.md` |
| A01 | The racer's four buildings and the Racing page's tiles | uma-art 2.6.0 (uma-platform #19, P45), pinned in the racer by D364 |
| A02 | The account bar's currency marks, tier crests and the Speed Ticket icon | uma-art 2.7.0 (uma-platform #20, P46), pinned by D364 |

The packets are readable with `git show d25d4e9:docs/handoff/tasks/<file>`.

## Later, not ready

- **The Expedition world map and its seven region crests** ([docs/rework/10](../rework/10-expeditions.md), phase 9).
  Its packet is written when phase 9 is specified.
