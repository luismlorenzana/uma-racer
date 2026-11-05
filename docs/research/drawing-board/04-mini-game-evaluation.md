# 04 · Mini-game evaluation and the recommended set

> **Research for the drawing board, second round (2026-11-04). Not a decision.** It applies the owner's second-round
> direction, which replaces the v1 lineup in the [README](README.md) §5: Stride Meter (a one-touch timing meter), Encore
> (rhythm) and Team Clash (the Puzzle & Dragons board) all fail it. It builds on [02](02-mini-games.md)'s reward contract
> and engine policy.

**Cards.**
- The content holds only SSRs, and era is a card's only quality ([06](../../archive/g2-manual/06-cards-and-bonds.md) §1), so
  "rarity" means era here.
- Each game names *hooks* for the card effect kinds in `cards.ts`. The card teammate owns the numbers.

**Resources** (provisional names), spent by hand in the trees:
- **Drills**, in five stat colours;
- **SP** and **Hints**;
- **Bond** per card, toward 80;
- **Aptitude points**;
- **Fans**;
- **Shards**, which unlock Umas;
- **Dishes**: one-use boosts, counted in uses.

## 1. Candidates

### 1.1 The constraint screen

The owner's constraints: no audio, no rhythm, light taps, no one-touch momentum, neither too simple nor too complex,
untimed, portrait and one thumb. A row passes them all unless it names a problem. Aiming and then watching is not
momentum.

| Candidate | Problem | Verdict |
|---|---|---|
| **Card race** (Pocket Card Jockey–like) | None (PCJ's rounds are timed; ours aren't) | **Core** |
| **Merge** (Triple Town–like) | None | **Yes** |
| **Auto-battler** (Super Auto Pets–like) | Close to too complex, so it is capped at 6 rounds | **Yes** |
| **Cooking: flavour map** (Potion Craft–like) | None | **Yes** |
| **Dice placement** (Dicey Dungeons–like) | None | **Yes** |
| **Peg board** (Peglin-like) | Luck; physics determinism | **Yes: built last, cut first** |
| Tile placement (Dorfromantik), route puzzle (Railbound) | None, but see §1.3 | Reserve |
| Hand scoring, drafting deckbuilder, push-your-luck | Overlap with the core, too complex, or too thin | Folded in |
| Slot engine (Luck be a Landlord) | Too simple: one tap a spin | No |
| Speed cooking (Cook Serve Delicious) | Timed, heavy tapping | No |
| Rhythm, timing meter, claw, runner, steering, P&D, tower defence | The owner's own list | **Out** (§4) |

### 1.2 The candidates in detail

The card race is §2. Each game below passes every constraint in §1.1, and each grows further in §3's table.

**Merge: "Training Yard"** (Triple Town–like)
- **How it plays:** a 6×6 yard.
  - Tap a cell to place the next piece. The next two are shown, and one can be held.
  - Three touching pieces of a kind merge one tier up (Sweat → Drill → Session → Regimen → Masterclass), in five stat
    colours.
  - *Fatigue* drifts toward your biggest piece. Boxed in, it becomes Rest, and three Rests clear fatigue nearby.
  - A stage is 60 placements, about 5 minutes.
- **Umas and cards:**
  - Her growth rates and the season's focus tilt the queue.
  - Each set card is a **Partner** piece. Placed by its colour, it lifts that merge a tier (training bonus), and
    specialty priority sets how often it comes.
  - Bonded (80+), a Partner pays double, as friendship training does.
  - Friend and Group cards are wild pieces.
- **Pays:** **Drills**, plus a little SP.
- **Grows:** Grand Masters adds fragments (eight make a Wisdom); Design Your Island adds facility pieces that boost
  the merges next to them.
- **Depth** high · **Cost** low–medium · **DOM** · **Determinism risk** low.

**Auto-battler: "Team Showdown"** (Super Auto Pets–like, untimed)
- **How it plays:** six rounds.
  - Each round, spend a fixed purse in a shop of three Umas and two cards.
  - Place units in a row of five, merge duplicates and freeze picks.
  - The heat then resolves itself: the front Umas duel and abilities fire.
  - Four wins is an A.
- **Umas and cards:**
  - **Units:** her career Uma is the captain; the others come from the roster and from rival teams.
  - **Stats:** Pace (Speed + Power) and Grit (Stamina + Guts), with Wit for trigger order.
  - **Abilities:** each comes from her unique skill's family.
  - **Cards are equipment:** type adds a stat, and effect kinds give small abilities (hint frequency shows the enemy
    row).
- **Pays:** **Shards** (beating a team pays its captain's, so play unlocks Umas) and **Fans**.
- **Grows:** Unity Cup introduces it; L'Arc adds 1-v-1 SS duels; Mecha adds chips in three cores; Beyond Dreams adds
  three-Uma teams scored by the weakest.
- **Depth** high · **Cost** high (balance, an ability library) · **DOM** + Motion · **Determinism risk** low.

**Cooking: "Festival Kitchen"** (a flavour map, after Potion Craft)
- **How it plays:** three dishes a stage, one judge each.
  - A marker starts at the centre of a flavour map (sweet, savoury, spicy, rich, fresh).
  - Each ingredient in a hand of five is an arrow: tap it to preview the path, then confirm.
  - Land deep in the ordered dish's zone without crossing Burnt or Bland cells, in few moves.
  - A judge's hidden taste pays a bonus.
- **Umas and cards:** judges are Umas. Cards are helpers with one technique each, by type:
  - Speed sears (move twice);
  - Stamina simmers (repeat);
  - Power kneads (double an arrow);
  - Guts rescues (undo a hazard);
  - Wit tastes (reveal the judge's taste);
  - Friend and Group swap a card in the hand.
- **Pays:** **Dishes**, one-use boosts on a tree node or a pre-race meal, echoing the original's +25% to +150% dishes.
- **Grows:** Great Food Festival introduces it, with five vegetable families; Yukoma adds a simmer pot; Tracen Diner
  adds regional pantries, ramen bases and a Jamboree.
- **Depth** medium–high · **Cost** medium (a map generator) · **DOM** + SVG · **Determinism risk** none.
- **Other forms rejected:**
  - a Quacks-style pot: too luck-led;
  - a Battle Chef grid: timed;
  - Venba-style recipes: little replay;
  - order tickets: speed-tapping.

**Dice placement: "Summer Camp"** (Dicey Dungeons–like)
- **How it plays:** seven camp days a stage.
  - Each day, roll her dice and place them in facility slots with rules (≥4, exactly 3, a pair). Terrain slots
    include beach and hill.
  - That day's support cards stand at facilities, as in the original career.
  - Partners split or bump dice.
  - No energy: the dice are the limit.
- **Umas and cards:**
  - Her Stamina and Guts set the dice count, and her aptitudes weight the terrain slots.
  - Specialty priority places cards at their own facility, and training bonus raises its pay.
  - A bonded card there doubles it, a rainbow.
- **Pays:** **Aptitude points**, plus a burst of **Drills**.
- **Grows:** L'Arc introduces it (its France trip replaces camp); U.A.F. adds sports in three genres with a heat-up;
  Beyond Dreams adds a teammate's die; Shuntaisai adds a Junior camp.
- **Depth** high. It has the best Uma fit, the original's training turn as a puzzle · **Cost** medium · **DOM** ·
  **Determinism risk** low.

**Peg board: "Fan Festival"** (Peglin-like)
- **How it plays:** three boards of six shots.
  - Drag to aim along a short guide line; release to drop a cheer orb through fan pegs.
  - Gold pegs pay hints, and refresh pegs reset the board.
  - Pick one upgrade (a "song") between boards.
  - Nothing moves until release, so it is neither timing nor momentum.
- **Umas and cards:**
  - Each set card is one orb. Its type sets the behaviour: Speed pierces, Stamina bounces longer, Power bursts, Guts
    splits, Wit lengthens the guide line, and Friend and Group multiply.
  - A bonded card's orb doubles gold pegs.
  - Her stats stay out of the physics.
- **Pays:** **SP** in bulk, **Fans** and **Hints**.
- **Grows:** Our Grand Concert introduces it, with token-coloured pegs and songs; Mecha adds an overdrive shot charged
  by gears; Yukoma adds strata dug with tool orbs.
- **Depth** medium · **Cost** medium–high · **Phaser** renders, our own solver simulates.
- **Determinism risk: high.**
  - Node and iOS Safari must agree, so: doubles with only `+ − × ÷ √` (exact under IEEE 754 in both), a fixed step,
    aim angles from a table, and golden-hash tests in both.
  - **Fallback:** a lattice whose pegs deflect by rule.

### 1.3 Other genres

| Genre | Why not in the set | Where it goes |
|---|---|---|
| Tile placement (Dorfromantik) | Fits Design Your Island, but the board needs panning and overlaps the merge | **Reserve 7th** |
| Route puzzle (Railbound) | Positioning already lives in the card race; levels are authored | Reserve |
| Hand scoring (Balatro) | A second card game on the same cards | Its scoring goes into the card race's spurt |
| Drafting deckbuilder (Slay the Spire) | Long and complex | The card race's knowledge draft (scenario 10) |
| Push-your-luck | Too thin alone | Banking in the card race; the Kitchen's simmer pot |
| Slot engine, solitaire variants | Little agency per tap; redundant next to the core | No |

Sources: [Triple Town (Spry Fox help)](https://support.spryfox.com/hc/en-us/articles/219104828-How-to-play-Triple-Town) ·
[Super Auto Pets basics](https://superautopets.wiki.gg/wiki/The_Basics) · [Peglin](https://en.wikipedia.org/wiki/Peglin) ·
[Potion Craft's map (PC Gamer)](https://www.pcgamer.com/potion-craft-has-finally-given-me-a-crafting-system-i-dont-hate) ·
[Potionomics brewing](https://gameplay.tips/guides/potionomics-how-to-make-super-potions.html) ·
[Venba (Kotaku)](https://kotaku.com/venba-cooking-game-switch-pc-ps5-xbox-game-pass-review-1850696280) ·
[Battle Chef Brigade (Game Informer)](https://gameinformer.com/games/battle_chef_brigade/b/switch/archive/2017/11/20/battle-chef-brigade-review) ·
[Quacks rules](https://lehi-innovation.github.io/boardgame-rules/rules/quacks-of-quedlinburg/) ·
[Dicey Dungeons](https://en.wikipedia.org/wiki/Dicey_Dungeons) · [Dorfromantik](https://en.wikipedia.org/wiki/Dorfromantik) ·
[Balatro](https://en.wikipedia.org/wiki/Balatro) · [Luck Be a Landlord](https://en.wikipedia.org/wiki/Luck_Be_a_Landlord)

## 2. The core: the card race

### 2.1 What Pocket Card Jockey actually does

- **The round:** Golf solitaire (play a card one rank up or down; Aces and Kings connect). Clearing cards builds
  energy; cards left behind tire the horse. Rounds are **timed** in both versions.
- **Positioning:** between rounds you spend points to drag the horse toward a **comfort zone**.
  - It has three levels; the narrower ones pay more.
  - Zones move with the rivals.
  - The rail saves stamina but can box you in.
  - Corners outside the zone cost stamina hearts.
- **The stretch:** energy becomes enthusiasm; find a gap and push.
- **Around the races:** retirement after three losses, and breeding.
- **Praised:** the pull of one more race, depth under simple taps, and fairness. Pocket Tactics: "you know where you
  messed up when you mess up."
- **Criticised:** frequent losses and harsh retirement; being boxed in despite good play; luck of the draw; long
  tutorials; and, over time, sameness (VGC calls it a one-trick pony).

**What we keep:** each leg's puzzle feeds the race, and positioning sits between legs.
**What we drop:** the timer, retirement and hidden rival moves.
**The fix for sameness:** the game grows every scenario.

### 2.2 Original rules: "Furlong Hand" (working name)

**In one sentence:** chain cards by colour or one step up, run them for ground or bank them for the spurt, and end
each leg in your running style's band.

**The pieces.**
- **The deck** (about 39 cards):
  - **stride cards** in five stat colours, valued 1–6: 15 base, plus 3 of its type per support card (wild for Friend
    and Group);
  - each support card itself, as a **Partner**;
  - her skills, as **Skill cards** (Wit sets how many).
- **The course:** legs follow the real layout (`course-layout.ts`). Sprint has 3 legs, Mile 4, Medium 5 and Long 6,
  then the **spurt**. Each leg's terrain favours a colour: Speed on straights, Power on corners and climbs.
- **The field:** 8 rival tokens on a position ladder, 1–9. Each shows its next move (surge, hold, fade, close the
  rail), at the tier's rival strength.
- **Her gauges:** **Breath**, from Stamina and distance aptitude; **Drive**, the spurt's fuel; and her **position**.

**A leg** (about 45–60 seconds):
1. **The spread:** four columns three deep, face up, with each front card playable. Below it, a draw pile of 8.
2. **Chain:** play a front card if it matches the lead's **colour** or is **exactly one higher** (6 is followed by 1).
   **Tap** to *run* it, for ground by its colour's yield (her stat grade plus terrain). **Swipe down** to *bank* it,
   for +1 Drive. A chain of 4 or more adds +1 Drive.
3. **When stuck,** flip a draw card as the new lead, for −1 Breath. At 0 Breath, Speed and Power yields halve, and Guts
   keeps full yield.
4. **The leg ends** when the spread is clear (a clean leg: +2 Drive) or the pile is empty. Each card left behind lets
   the field gain.
5. **Line choice:**
   - **Rail:** free, but if a rival closes it, one column starts *blocked* until a Power or Wit card is played.
   - **Middle:** neutral.
   - **Outside:** −1 Breath, never blocked, and Speed +1.
6. **Her band:** Front 1–2, Pace 2–4, Late 4–7, End 6–9, and strategy aptitude widens or narrows it. Ending a leg in
   band pays +1 Drive; outside it costs −1 Breath.

So a Front runner runs most cards, while an End runner banks and sits back.

**The spurt:** one last spread in which Drive multiplies every run card. Skill cards fire on their conditions (a
corner skill on a corner leg). The finish order follows from her ground against the rivals' scripted race.

**Grade:**
- **S:** a win by 2 or more lengths, with all three tasks done (two clean legs, every Partner played, every leg in
  band);
- **A:** a win;
- **B:** top 3;
- **C:** top 5;
- **D:** anything worse.

**Length:** 3.5–6.5 minutes.

| Source | In the race |
|---|---|
| Card **type**, **era** | The colour of its stride cards and Partner (Friend and Group are wild); the Partner's yield |
| **Training bonus**, **stat bonus** | Its colour's yields up by a percentage and by +1 |
| **Specialty priority** | The Partner is dealt into the first spread |
| **Friendship bonus** | At bond 80+ the Partner is a *rainbow*: the next chain's yields double |
| **Hint frequency** | Reveals the next leg's spread |
| **SP bonus**, **race bonus**, **initial stats** | The stage's SP pay; Drive at the spurt; starting Breath |
| **Unique effect** | A signature ability, from a small library |
| **Hint skills, golds** | A Partner in a chain of 4 or more drops a hint for one of its skills |
| Uma **stats** | Yields; Breath (Stamina); Skill cards and a peek (Wit) |
| Uma **aptitudes**, **strategy** | Distance sets Breath cost, surface the base yield, style the band's width; strategy sets the band |

**Balance:** stats should move a grade at most, so play decides. The sims hold a competent bot at A on its rung.

**Pays:** **Bond** for each card that took part (more for Partners played), **Hints** from those cards' own skills, and
a little SP.

**Cost** medium–high (rules, rival scripts, legs from layouts, bots) · **DOM** + Motion, cards in the bottom 60% ·
**Determinism risk** low (a seeded shuffle).

### 2.3 One example turn

**The setup:**
- Special Week, Late (band 4–7), on leg 3 of 5 at 2,000 m: the back straight, where Speed gets +1.
- She sits 6th, with Breath 7/10 and Drive 3.
- The rivals' signs say: #2 surges, #5 closes the rail.
- The lead card is **Stamina 2**. The front cards are Stamina 5, Power 3, **Kitasan Black** (Speed Partner, 4) and
  Wit 2.

**The play:**
1. **Power 3** (one higher), *run*: +1 ground.
2. **Kitasan Black 4** (one higher), *run*. Her training bonus gives Speed +1 this leg, and Speed 5 is uncovered.
3. **Speed 5** (one higher), *run*: +3 ground.
4. Under it lies **Speed 1** (same colour). She's Late, so it's *banked*: +1 Drive. The chain reaches 4: +1 Drive.
5. **Wit 2** (one higher), *run*: +1 ground.
6. Nothing showing is Wit or a 3, so she flips a draw card (Breath 6): **Stamina 6**. She *runs* **Stamina 5** (same
   colour), and the leg goes on.

**The end of the leg:**
- 10 of 12 cleared; the two left let the field gain about a length.
- She ends 5th, in band: +1 Drive.
- For the final corner, #5 is closing the rail, so she takes the **Middle**.

### 2.4 Growth and the race engine

**Growth:**
- The card race gets a new rule in seven scenarios (§3).
- Each scenario's **finale** is a card-race cup: URA's three heats, Trackblazer's points, the GM race, the Arc on heavy
  ground.

**Relation to the engine:**
- **Same inputs.** It reads the same stats, aptitudes, strategy, skills and course layout, so building her helps both.
  It teaches the engine's ideas: holding position by style, being blocked, stamina and the spurt
  ([03](03-racer-today.md) §2).
- **A prep heat, not the race.** It is its own small seeded model, not `simulateRace`. It runs as the prep heat on her
  next objective's course and never decides that objective.
- **No hand-off by default** (open point 3).

Sources: [Pocket Card Jockey (Wikipedia)](https://en.wikipedia.org/wiki/Pocket_Card_Jockey) ·
[Nintendo Life](https://www.nintendolife.com/reviews/3ds-eshop/pocket_card_jockey) ·
[KoopaTV mechanics](https://www.koopatv.org/2017/02/pocket-card-jockey-game-mechanics.html) ·
[Ride On! (Pocket Tactics)](https://www.pockettactics.com/pocket-card-jockey-ride-on/review) ·
[Ride On! (Shacknews)](https://shacknews.com/article/138992/pocket-card-jockey-ride-on-review-score) ·
[Ride On! (VGC)](https://videogameschronicle.com/review/review-pocket-card-jockey-ride-on-ensures-game-freaks-cult-favourite-wont-go-to-pasture) ·
[Flamme Rouge rules (exhaustion and drafting)](https://lehi-innovation.github.io/boardgame-rules/rules/flamme-rouge/)

## 3. The recommended set: six games

| Game | When in the season loop | Owns | Introduced by | Grows in |
|---|---|---|---|---|
| **Furlong Hand** (card race) | Each season with an objective race, as its prep heat; every finale | Bond, Hints | URA Finale (#1) | 2, 3, 6, 8, 10, 12, 15 |
| **Training Yard** (merge) | Spring, and any slot whose game isn't out yet | Drills | URA Finale (#1) | 5, 11 |
| **Team Showdown** (auto-battler) | Winter of Junior and Classic (the year-end team event) | Shards, Fans | Unity Cup (#2) | 6, 9, 13 |
| **Fan Festival** (peg board) | Autumn | SP, Fans, Hints | Our Grand Concert (#4) | 9, 12 |
| **Summer Camp** (dice) | Summer of Classic and Senior | Aptitude points, Drills | Project L'Arc (#6) | 7, 13, 15 |
| **Festival Kitchen** (cooking) | Winter of Senior (the New Year feast) | Dishes | Great Food Festival (#8) | 12, 14 |

**The loop:**
- A season is one stage, then the tree allocation, then her races: about 13 stages and 75 minutes a career
  ([01](01-uma-career-and-scenarios.md) §5).
- Any unlocked game can be replayed between seasons, for free. Replays pay every-run outputs
  ([02](02-mini-games.md) §2).

**What each scenario adds**

| # | Scenario | Adds to | What it adds |
|---|---|---|---|
| 1 | URA Finale | Card race, Yard | Both games; the finale is three card-race heats |
| 2 | Unity Cup | **Team Showdown** (new); card race | Team against team. In the card race, a teammate token whose spirit burst gives a free chain |
| 3 | Trackblazer | Card race | Coins for placings; a shop between legs (carrot, whip, megaphone); a points cup |
| 4 | Our Grand Concert | **Fan Festival** (new) | Five token-coloured pegs; songs as upgrades |
| 5 | Grand Masters | Yard | Fragments in three colours; 8 make a Wisdom that powers its colour |
| 6 | Project L'Arc | **Summer Camp** (new); card race; Showdown | The overseas camp; heavy ground and an expectation gauge for bold lines; SS duels |
| 7 | U.A.F. Ready GO! | Camp | Sport slots in three genres; a heat-up |
| 8 | Great Food Festival | **Kitchen** (new); card race | Five vegetable families; dishes; a pre-race meal |
| 9 | Run! Mecha | Showdown, Fan Festival | Chips in three cores; gears charge an overdrive shot |
| 10 | Twinkle Legends | Card race | Draft one of three knowledge cards after each leg |
| 11 | Design Your Island | Yard | An island board; facility pieces boost the merges next to them |
| 12 | Yukoma Hot Springs | Fan Festival, Kitchen, card race | Strata dug with tool orbs; a simmer pot; a bath token that refills Breath once |
| 13 | Beyond Dreams | Showdown, Camp | Three-Uma teams scored by the weakest; a teammate's die |
| 14 | Tracen Diner | Kitchen | Regional pantries, ramen bases, the Jamboree |
| 15 | Goshiki Shuntaisai | Card race, Camp | Teachings on Partners that transform after chains; a Junior camp |

**Build order.** A scenario is about 4 weeks of play, so each game ships before the owner reaches it.
1. **The minimum slice,** which is the cut-over: the stage framework (02 §5), trees, calendar, **Furlong Hand** and
   **Training Yard**. It covers stats, bonds, hints and SP.
2. **Team Showdown,** whose balance sims start during step 1.
3. **Trackblazer's shop.**
4. **Fan Festival,** after a one-week determinism spike (the same hash in Node and iOS Safari), or else lattice pegs.
5. **Fragments**, which completes tier 1.
6. **Summer Camp**, then **Festival Kitchen**, then the remaining additions in scenario order.

## 4. Rejected

- **Ruled out by the owner:**
  - rhythm (v1's Encore);
  - one-touch timing (v1's Stride Meter, the claw machine);
  - runners and steering (01's Overseas Run);
  - the Puzzle & Dragons board (v1's Team Clash: Unity Cup's team play moves to Team Showdown);
  - tower defence.
- **Rejected here:**
  - speed cooking, for its timers and tapping;
  - the slot engine, for too little agency;
  - Balatro, deckbuilding, push-your-luck and solitaire, which overlap the core or are too thin alone. Their ideas are
    folded into the core (§1.3).
  - v1's one game per scenario, which becomes growth (§3).

## Open points for the owner

1. **Six games or five?** Recommended: six, with Summer Camp, the original's training turn as a puzzle. Fan Festival
   is the one to cut if its physics proof fails.
2. **One stage a season?** Recommended: yes, about 75 minutes a career. Two (a game plus a prep heat) take about
   2 hours, roughly 7 weeks a scenario for 25 Umas.
3. **Does the card race touch the real race?** Recommended: no, it pays resources only. The alternative: an A or S prep
   heat gives her +1 mood in that objective, which needs a small engine input.
4. **Peg physics:** recommended: a continuous solver behind the spike. The alternative is a rule-based lattice: certain
   to be deterministic, but less lively.
5. **Team Showdown's units:** recommended: her roster plus rival teams, whose captains pay Shards on defeat, so locked
   Umas can be earned in play.
