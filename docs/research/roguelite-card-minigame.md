# Roguelite Card Minigame: Research and Options

Prep for replacing Bond Recall (match-2) with an adventure-style roguelite built around one card being bonded and a
run of randomized cards. Numbers are illustrative drafts.

> **Decided 2026-09-25:** option B, all or nothing, owned cards only (no guests or scouting), and Spark Match kept
> separate (D146). The owner also re-scaled limit breaks to 0★–5★ (D147) and tickets to one per run (D148). The plan is
> M019 (stars and tickets, landed 2026-09-25), then M020, which shipped Friendship Training on 2026-09-26 (D177;
> [Minigames](../design/minigames.md#friendship-training--card-stars)).

## Why replace Bond Recall

- **It is the same game every time.** A memory grid has one skill (recall) and no decisions, so the fourth clear feels
  like the first. The faces are the only place the collection appears, and they are decoration.
- **It is played a lot.** A card needs 4 clears per scenario it is bonded in (D127), so bonding one card everywhere is
  up to 56 clears. The minigame is the card pillar's whole grind, so it has to hold up to repetition.
- **It teaches nothing about the rest of the game.** Nothing in a match-2 run touches card types, skills, races or the
  scenario it is played in.

## What the new game must feed

The contract Bond Recall already satisfies, which any replacement keeps:

| Loop | Today | Must stay true |
|---|---|---|
| Card bond | A clear gives +1 bond to one card in one scenario (D127); max bond grants the one-time Card Select Coupon; each advance +5 tickets | A run names a card and a scenario, and a clear is one bond |
| Cost | 10 tickets per run, win or lose | One ticket price per run |
| Determinism | Seeded from the save, target and attempt; no `Math.random` | The whole run replays from its seed; reload resumes it |
| Device | One-handed on a phone, DOM route, lazy-loaded | Portrait, thumb zone, 44 pt targets, main bundle ≤ 180 KB |

What we already have to build card identity from, **without hand-authoring 312 cards**:

- **Per card:** type (72 Speed, 55 Stamina, 57 Power, 59 Guts, 53 Wit, 11 Friend, 5 Group), an 8-weight effect profile,
  the original's unique effect, about 7.5 hint skills and 3.6 event skills, era, character and full art (D144).
- **Per skill** (1,506): kind (598 white, 346 gold, 250 unique, 290 inherited unique, 22 upgraded), SP cost, and
  activation conditions with race meaning (corner, straight, final leg, phase, position).
- **Per scenario:** era window, race calendar and career stages (D137), and the original scenario mechanics that D116–D118
  once modelled as training modifiers (teams, shop items, notes, fragments, stamps, genres, cooking, research).

The owner's brief: **an adventure-style roguelite, a main card to be trained, randomized cards around it**, and a look
at how popular card games could feed card leveling, card acquisition and the per-scenario training loop.

## The landscape

| Game | Popularity signal | Core loop | Worth borrowing |
|---|---|---|---|
| **Slay the Spire** (2019), **Slay the Spire II** (early access March 2026) | II sold 3 million in its first week and 5.3 million by the end of March | Branching act map; energy-and-draw combat against enemies that show their intent; pick 1 of 3 card rewards; relics; rest sites (heal or upgrade); card removal; Ascension difficulty | The map, the 1-of-3 reward, intents, relics, Ascension |
| **Balatro** (2024) | 5 million sold by January 2025; the iOS and Android release grossed $9.3 million by then | Play poker hands to beat a score target; Jokers rewrite scoring; 8 antes of small, big and boss blind, each boss with a rule; shop between blinds | Score targets instead of combat, rule-bending passives, boss rules, a shop, proven on phones |
| **Monster Train** (2020), **Monster Train 2** (2025) | 2 is 95% positive on Steam | Defend a pyre across three floors; units plus spells; a **champion** whose upgrade path you choose mid-run | The main unit with a chosen upgrade path |
| **Wildfrost** (2023, on mobile) | Acclaimed for its counter system | A randomly generated **leader** whose fall ends the run; recruit companions; every unit acts on its own countdown instead of energy | The leader as the run's heart; recruiting cards along the way |
| **Inscryption** (2021) | Genre crossover hit | Sacrifice economy; sigils (keyword abilities) that move between cards; narrative framing | Keywords as the unit of card identity |
| **Hearthstone Dungeon Run / Duels** | Mass-market proof of the format | A hero plus treasure picks against bosses with passives | Treasure picks as run-defining passives |
| **Luck be a Landlord** (early access 2021) | Long-selling indie | An auto-resolving slot "deck"; pay rent every few spins | One-thumb play where the build does the work |
| **Deck RX** (in development) | No reviews yet | A racing deckbuilder: cards speed up, brake and drift; win by finishing first | Proof that a race can be a card game; no evidence yet that it plays well |
| **Umamusume** career (our source) | The game this one is built on | A three-year career of training turns where support cards appear on facilities, friendship ("rainbow") training, events, and races as goals | The fantasy. We deleted the turn loop (D120) because its random deal decided the outcome; the lesson is to keep the fantasy and replace the deal with choices |

Two points from the makers. Mega Crit's GDC talk on Slay the Spire's balance argues every card should have a place,
and that a single-player roguelite can afford rare overpowered combos because they hurt no one. Balatro's creator
calls it "an indie take on solitaire": simple rules, depth from what the passives do to them. Both are good fits for a
personal, one-player game.

## Features worth borrowing, by the loop they feed

| Feature | From | Card bond | Card acquisition | Scenario loop |
|---|---|---|---|---|
| **Main card as leader or champion**: in every opening hand, with a signature built from its unique effect and gold hint skills, and an upgrade path you choose mid-run | Wildfrost, Monster Train | ● the run *is* this card's training | | |
| **Friendship gauge**: the main card fills a gauge each time it is played, and a full gauge unlocks its big effect, like the original's rainbow training | Umamusume | ● | | |
| **Difficulty by bond**: the run from bond 3 to 4 is longer and harder, like Ascension or Balatro's stakes | Slay the Spire, Balatro | ● (as today's pair counts grow) | | |
| **Pick 1 of 3 rewards** from the scenario's era pool | Slay the Spire | | ● every run meets new cards | ● era gates the pool |
| **Guest cards**: unowned cards can appear as rewards and join the run | Wildfrost recruiting | | ● you try a card before you own it | |
| **Scouting**: finishing a run with a guest in the deck earns it a scout mark; 3 marks unlock it, as 5 Uma Shards make an Uma Select Coupon | new | | ● a second path to new cards, earned by bonding | |
| **Skills as relics**: the run's passives come from the scenario's hint skills, each rewriting a scoring or play rule | Balatro Jokers, relics | ● | | ● teaches what a skill does in races |
| **A scenario twist per run**: each scenario's run adds the original scenario's mechanic (Unity Cup teams, Trackblazer shop items, Grand Live notes…) | Balatro boss blinds, Monster Train covenants | | | ● gives the 14 scenarios play identity |
| **Races as bosses** at stage breaks, named from the scenario's real calendar (G3, G2, G1, as in career stages) | Slay the Spire acts | ● | | ● |
| **Shop and removal**, with fans as run currency | Balatro, Slay the Spire | | ● | |
| **Training Level progress** for the Uma the run is launched from | new | | | ● could fold Spark Match into the same run later |

## Four options

All four share an **adventure frame**: a short branching map of weeks, a boss race at the end of each stage, a 1-of-3
reward after encounters, a shop, rest stops and events drawn from the main card's event skills. They differ in **what
an encounter is**, which decides almost everything about how the game feels and what it costs to build.

### A. Bond Trail: Slay the Spire–style combat

- **Encounter:** a duel with a rival Uma who shows her intent ("surges for 8", "settles in"). You spend 3 energy a turn
  on cards: Speed takes the lead (damage), Stamina keeps pace (block), Power bursts (multi-hit), Guts scales as you tire,
  Wit draws and foresees, Friend and Group give energy. Stamina is your health; the race boss is a harder rival with a
  scripted pattern.
- **Main card:** innate every fight; its signature card upgrades along a path you pick at rest stops.
- **Random cards:** 1-of-3 rewards and the shop, from the scenario's era pool, guests included.
- **Run:** 3 stages of about 5 nodes; 15–20 minutes.
- **Build:** the largest. It needs a combat engine, 15–20 rival patterns with intent AI, events and the map, plus
  generated effects for 312 cards.
- **Risk:** "combat" sits oddly on friendly rivals, it is the longest session, and it has the most to balance.

### B. Friendship Training: a Balatro-style scoring journey *(recommended)*

- **Encounter:** a **training week**. Pick a facility, then play support cards from a hand of 7 to reach the week's
  target, with 3 plays and 2 redraws:
  - Every card scores points: more on a facility of its own type, fewer elsewhere, and Friend and Group cards anywhere.
  - The multiplier grows with **friendship training**: every extra card on its own facility adds to it, and three or
    more make a rainbow.
  - Skills (the relics) rewrite the rules, e.g. "Corner Recovery: the first Stamina card each week scores double".
- **Race bosses:** the stage's race sets the target and a rule taken from its course. A long race boosts Stamina, a
  heavy track dampens Speed, a named rival spoils your first play.
- **Main card:** always in hand. Playing it fills its **friendship gauge**; a full gauge makes its facility a rainbow
  for the rest of the run, and its unique effect adds its own twist.
- **Random cards:** the deck starts as the main card plus its card set. Rewards, the shop (paid in fans) and guests add
  to it.
- **Run:** by bond, 3 weeks and a G3 race (6 minutes) up to 6 weeks and a G1 (12 minutes).
- **Build:** medium. The scoring engine is pure TypeScript that is easy to test, and a headless bot can balance it, as
  `sim:*` does for races. The UI is a hand, a facility and a score counter, with no enemy AI. Card identity comes
  straight from type, profile and unique effect; relics come from skill categories.
- **Risk:** a scoring puzzle can feel abstract, and exponential scores need a careful cap. Balatro shows it holds up on
  a phone.

### C. Race Deck: card-driven races on real courses

- **Encounter:** a race played section by section on a **real course** (our layouts already carry straights, corners,
  hills and the final straight). Each turn you play skill cards to set pace, save stamina and overtake. A card's
  conditions come from its skill, so a corner skill only fires on a corner. Rivals show their next move; the final
  straight is the spurt.
- **Main card:** its unique or gold skill is the signature card, and its partner bonus grows as you play it.
- **Random cards:** skills drawn from the scenario's hint skills, and cards from rewards.
- **Run:** 3–5 races with training and events between; 12–20 minutes.
- **Build:** large. It is a second, turn-based race model beside the 15 Hz engine, with rival AI and a section-by-section
  UI.
- **Risk:** the strongest theme but two race models to keep apart, since players would ask which one decides the real
  races. It fits better once racing itself is settled.

### D. Leader & Companions: Wildfrost-style lanes

- **Encounter:** rivals advance down two lanes; your support cards are companions on the board, each acting on its own
  countdown; you play items and skills. The main card leads, and the run ends if it runs out of stamina.
- **Random cards:** companions recruited from rewards, guests included.
- **Run:** 10–15 minutes.
- **Build:** large. A tactical board with timers on every unit is hard to read at 390 pt.
- **Risk:** tactics over theme, and the densest screen of the four.

### Side by side

| | A. Bond Trail | B. Friendship Training | C. Race Deck | D. Leader & Companions |
|---|---|---|---|---|
| Depth over many runs | ●●●●● | ●●●●○ | ●●●●○ | ●●●●○ |
| Reads on a phone | ●●●○○ | ●●●●● | ●●●○○ | ●●○○○ |
| Theme fit | ●●●○○ | ●●●●● | ●●●●● | ●●●○○ |
| Uses the data we have | ●●●○○ | ●●●●○ | ●●●●● | ●●●○○ |
| Build cost (more ● is cheaper) | ●●○○○ | ●●●●○ | ●●○○○ | ●●○○○ |
| Ease of balancing with a bot | ●●○○○ | ●●●●● | ●●●○○ | ●●○○○ |
| Session length | 15–20 min | 6–12 min | 12–20 min | 10–15 min |

## Recommendation

**Build B inside the shared adventure frame, and keep C in reserve.**

B turns the original game's best moment, friendship training, into a decision you make rather than a deal you receive,
which is exactly what D120 asked of the minigames. It uses the card data directly (type, profile, unique effect,
skills), stays short enough for the ticket price, reads on a phone, and can be tuned with a headless bot before anyone
plays it. C is the most on-theme and would teach racing, but it deserves to come after racing itself is settled, so the
game never has two competing race models in flux.

A first slice worth playing before replacing Bond Recall:

1. URA Finale only: 3 training weeks and one G3 race boss, with the main card's gauge and 1-of-3 rewards.
2. About 20 skill relics generated from skill categories, plus a shop.
3. A run bot and balance table (`sim:*` style) for win rate by bond.
4. Bond Recall stays live until the new run beats it; the ticket price and bond contract stay the same.

## What the owner needs to decide

1. **Direction:** A, B, C, D or a hybrid.
2. **Stakes:** keep all-or-nothing (a clear is a bond), or add partial progress (each race boss beaten banks a
   memory, and 3 memories make a bond)?
3. **Acquisition:** should runs meet unowned guest cards, and should finishing with one scout it towards an unlock?
4. **Training Level:** keep Spark Match for Training Levels, or let the run also grant Training Level progress to the
   Uma it is launched from, eventually folding two minigames into one?
5. **Session:** is 6–12 minutes for 10 tickets the right size, or should runs be shorter and cheaper?

## Sources

- [Slay the Spire II (Wikipedia)](https://en.wikipedia.org/wiki/Slay_the_Spire_II) and
  [Mega Crit's release announcement](https://www.megacrit.com/news/2026-02-19-release-date-trailer/)
- [Choost Games: the best roguelite deckbuilders in 2026](https://choostgames.com/blog/best-roguelite-deckbuilders-2026/) (Slay the Spire II sales)
- [Game World Observer: Balatro crosses 5 million](https://gameworldobserver.com/2025/01/21/balatro-another-1-5-million-copies-total-5m-units)
  and [Pocket Gamer: Balatro's sales across devices](https://www.pocketgamer.com/balatro/five-million-sales/)
- [Balatro Wiki: blinds and antes](https://balatrowiki.org/w/Blinds_and_Antes) and
  [Rogueliker's interview with LocalThunk](https://rogueliker.com/balatro-interview/)
- [GDC Vault: Slay the Spire, Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics)
- [Monster Train 2: champions ranked (Game Rant)](https://gamerant.com/all-monster-train-2-champions-ranked/) and
  [a Monster Train beginner's guide (BlueStacks)](https://www.bluestacks.com/blog/game-guides/monster-train/mstn-beginners-guide-en.html)
- [Wildfrost (Wikipedia)](https://en.wikipedia.org/wiki/Wildfrost) and [its Steam page](https://store.steampowered.com/app/1811990/Wildfrost/)
- [Deck RX on Steam](https://store.steampowered.com/app/1529180/Deck_RX_The_Deckbuilding_Racing_Game/)
- [Roguelike deck-building game (Wikipedia)](https://en.wikipedia.org/wiki/Roguelike_deck-building_game)
