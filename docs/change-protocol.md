# Asking for changes: one game or both

> The owner's protocol (2026-10-16). The same text is in uma-rpg, uma-racer and uma-platform
> (`docs/change-protocol.md`). Change all three together.

## Where to ask

| The change | Ask in | Example |
|---|---|---|
| **One game:** its rules, screens, places, words, balance, economy, save, and which tabs and chips it shows | That game's session: **uma-rpg** or **uma-racer** | "The Forge picker should show icons only" |
| **Both games:** anything uma-kit draws (see below) | The **uma-platform** session, starting with **"Both apps:"** | "Both apps: dock the bottom bar to the screen's edge" |
| **Art:** new or redrawn pixel art | The game's session. It writes a ChatGPT packet, and the art ships in uma-art | "Battle tiles for the Hub" |
| **Master data:** Umas, outfits, skills | The **uma-platform** session | "Import the new outfits" |

**Not sure? Ask in the game you were looking at.** If the change belongs in the kit, that session says so in one line
and writes it up as a "Both apps:" request. It runs that request itself when uma-platform is one of its folders, and
otherwise hands it to the uma-platform session. Nothing waits on you to re-route it.

## What uma-kit draws

uma-kit is `@luismlorenzana/uma-kit`, in uma-platform's `packages/kit`. Its parts:
- **The screen:** the iPhone frame and safe areas, light and dark, colours and fonts.
- **The bars:**
  - the top bar: the initial, the tier crest, three currency chips and the sync chip;
  - the bottom bar: five slots, the raised centre tab and badges.
- **Navigation:** the menu sheet, the side panel (quick look), the place header, and the floating pill (Collect all).
- **Pieces:** buttons, chips, tabs, panels, bottom sheets, the (i) help button, animated numbers, icons and pixel marks.
- **The Hub map:** terrain, roads, props, buildings, place buttons, pips and the page swipe.

Each game fills them in: its places and where they stand, its tabs and their names, its currencies, its words and its
art. Two examples:
- "Rename the Battle tab" is a uma-rpg change.
- "Make every tab label bigger" is a both-apps change.

## The sessions

Keep three long-lived sessions, one per repo:
- **uma-rpg** and **uma-racer:** most of the work. Each changes only its own repo, pins kit versions and deploys its
  game.
- **uma-platform (both apps):** opened in uma-platform with uma-rpg and uma-racer added as folders. It changes the
  kit, the art and the master data.

No other repo is needed: uma-platform already holds everything the games share.

## How a "Both apps" change runs

1. **Change and test.** The uma-platform session changes the kit and tests it inside both games before releasing:
   - their checks pass;
   - anything visible is checked in the iOS Simulator's Home Screen app, in light and dark.
2. **Release.** It releases a kit version: a patch for a fix, a minor for anything you can see.
3. **Pin and deploy.** Each game pins the exact version and deploys:
   - the platform session messages each game's session with the version and what changed;
   - if a game's session isn't running, the platform session pins that game itself.
4. **Log.** When the change is visible, each game logs a decision and keeps its manual (`docs/game/`) in step.

## Rules for every session

- **No forks.** A game session never edits, copies or forks kit code. A fix that belongs in the kit goes to the
  uma-platform session as a diff or a "Both apps:" request.
- **Options, not copies.** The kit takes values, words and links as props. Behaviour only one game needs becomes an
  option in the kit, not a copy in that game.
- **Check the edges on the iPhone.** Anything at the screen's edges (the notch, the home indicator, the bars) is checked
  in the iOS Simulator's Home Screen app, not only in a desktop browser. iOS 26 sizes a Home Screen app differently from
  Safari (uma-rpg D149).

## Starters

- **One game:** open that game's session and describe the change.
- **Both games:** open the uma-platform session and start with **"Both apps:"**.
- **A shared problem spotted in one game:** send the screenshot to the uma-platform session with "Both apps:". The fix
  reaches the other game too.
