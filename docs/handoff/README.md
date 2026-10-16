# Handoff: packets for ChatGPT

Self-contained tasks that a ChatGPT (or Codex) session can take without this conversation's context, one pull request
each. Start a fresh session with [master-prompt.md](master-prompt.md). A packet is deleted once its work merges (D104),
so [tasks/](tasks/) only holds work still ahead.

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
| [A01](tasks/A01-racer-buildings-and-racing-page.md) | The racer's four buildings (Card Library, Gym, Racecourse, Trophy Hall) and the Racing page's tiles | uma-platform | M |
| [A02](tasks/A02-home-screen-marks.md) | The account bar's currency marks, tier crests and the Speed Ticket icon | uma-platform | S |

A01 is the one the owner is waiting on: until it ships, the Hub draws those four places as plain placeholders and the
Racing page borrows another page's ground. A02 can follow it, or run alongside it as a separate pull request.

## Later, not ready

- **The Expedition world map and its seven region crests** ([docs/rework/10](../rework/10-expeditions.md), phase 9).
  Its packet is written when phase 9 is specified.
- **A pixel-art look for the whole interface** (panels, buttons and frames in uma-art's style, not only the Hub). The
  owner will decide whether to go there after living with the Hub. A calibration packet comes first if they do.
