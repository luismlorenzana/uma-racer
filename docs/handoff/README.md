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

## For ChatGPT, in order

| Packet | What | Repo | Size |
|---|---|---|---|
| [A03](tasks/A03-iphone-band-and-level-rule.md) | The iPhone band under the bottom bar, and the level rule for Uma pickers (uma-platform P48, Phase 0) | uma-racer | S |

A03 is code in uma-racer, not art: ChatGPT opens the pull request, and Claude merges, deploys and verifies it.

| Done | What | Landed |
|---|---|---|
| A01 | The racer's four buildings and the Racing page's tiles | uma-art 2.6.0 (uma-platform #19, P45), pinned in the racer by D364 |
| A02 | The account bar's currency marks, tier crests and the Speed Ticket icon | uma-art 2.7.0 (uma-platform #20, P46), pinned by D364 |

The packets are readable with `git show d25d4e9:docs/handoff/tasks/<file>`.

## Later, not ready

- **The Expedition world map and its seven region crests** ([docs/rework/10](../rework/10-expeditions.md), phase 9).
  Its packet is written when phase 9 is specified.
- **A pixel-art look for the whole interface** (panels, buttons and frames in uma-art's style, not only the Hub). The
  owner will decide whether to go there after living with the Hub. A calibration packet comes first if they do.
