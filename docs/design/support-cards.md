# Support Cards

> All numbers are **draft values for tuning**.

## SSR only ✅

The game only has **SSR** cards. Cards that were R or SR in the original game are not included.

## Card template (static)

| Field | Notes |
|---|---|
| `id`, `character`, `title` | Taken from the original game's data |
| `type` | Speed, Stamina, Power, Guts, Wit, Friend, or Group. All seven are usable |
| `jpReleaseDate` | Decides the **era** (see [Scenarios](scenarios.md#era-windows)) |
| `obtain` | `event` / `free` / `gacha`. `event` and `free` make up the **starter set** |
| `effectProfile` | Now feeds only **Race Bonus** |
| `hintSkills`, `eventSkills` | Its whites (hints) and golds (the golds among its events): each node it fills pays the next of each (D182) |
| `icon`, `art` | Local asset references only |

## Ownership vs. the card set

- **Owning** is account-wide. Cards come from the starter set or from a Card Select Coupon, on the card's own page or
  in the album (D198, see [Collection](collection.md#unlocking-cards)).
- **Power belongs to a scenario.** A card's stars (0★–3★) and the nodes it fills are per scenario; nothing about a
  card's strength is account-wide. There is no card level (D130, D147).
- A **card set** is per Uma, **per scenario** (D125): **six slots**, era-gated to that scenario's tier, drawn
  from owned cards. Six everywhere — the old 4/5/6 tier ramp is gone.
- No duplicate card and no two cards of the same character in one set.
- **Stars belong to a scenario, and are shared by every Uma racing there** (D127). Starring a card in URA
  Finale improves it for every Uma in URA Finale; in Unity Cup that same card starts at 0★ again. So the
  first Uma you take into a scenario pays for the card set, and every later one rides free.
- **Friend and Group cards pay Skill Points instead of stats**, in any slot; every other card pays its stats
  ([Constellations](constellations.md#skill-point-cards), D132).

The card set decides what the scenario's **card nodes** may hold. Slotting a card into the set does nothing on
its own — the card only pays once it occupies nodes.

**Replacing a card in its slot hands its nodes to the replacement**, so trading up keeps the constellation
filled; **removing a card empties its nodes** rather than leaving them assigned to a card the set no longer holds
(D129). The card set is edited on the Training scene's Card set tab ([UX](ux.md#training-scene)).

## What a card is worth

Almost everything a card used to do lived in the training turn, which no longer exists. What remains:

| Property | Effect |
|---|---|
| **Type** | how a card node distributes its value ([table](constellations.md#what-a-card-node-pays)), the same for every card of the type (D180) |
| **Stars** | scale every node the card occupies: 0★ 60% → 3★ 100% |
| **Era** | scales every node against the *scenario*: current era 100%, −5 points per era older, floor 40% |
| **Skills** | the next white (`hintSkills`) and the next gold (its event golds) for each node it occupies (D182) |
| **Race Bonus** | **Uma EXP from races** while the card is in the active set, from 1★ |

Deleted with the training turn: Training Bonus, Friendship Bonus, Specialty Priority, Hint Frequency, Stat
Bonus, and Initial Stats. There is no card EXP.

**Era is what makes a newer card better** (D126). Two Speed cards of the same type hand you the same kind of
skills and the same stat split; the newer one pays more per node. Because the penalty is measured against the
scenario rather than in absolute terms, an old card fades as an Uma climbs tiers without ever becoming
worthless, and the tree budget stays the ceiling at every tier.

### One split per type

Every card of a type pays the same split (D180): the main stat 70 and the stat its facility also trains in the original
30 (Speed with Power, Stamina with Guts, Power with Stamina, Wit with Speed), and Guts 60 with Speed and Power 20 each.
So which card goes on which node is a choice about the main stat, and two cards of a type differ by their skills, era,
stars and Race Bonus. A per-card tilt of the split (D125) is gone: meant as a small nudge, it reached its ±10-point cap
on almost every card and sent a third of them to 60/40 (Guts 50/25/25).

Friend and Group cards pay skill points rather than stats (D132); their value is the loadout they buy.

## Stars

A card holds **0★ to 3★ in each scenario** (D200), and there is **no card level** (D130). It earns **one star per clear**
of the card minigame, [Friendship Training](minigames.md#friendship-training--card-stars), in
the scenario that run named. That is the only way. **Bond** is the act of raising a card's stars: the button that
launches the minigame, and what the minigame is about.

| Stars | 0★ | 1★ | 2★ | 3★ (Max) |
|---|---|---|---|---|
| Node pay | 60% | 68% | 84% | **100%** |
| Race Bonus | — | 68% | 84% | **100%** |

- **Three stars, not five** (D200): the three are the old 1★, 3★ and 5★, so a maxed card pays exactly what a 5★ card
  did, and bonding a set is three clears a card instead of five.
- **Race Bonus** starts at 1★ and follows the node curve to its full value at 3★.
- **3★** is max: full node value, full Race Bonus, and the card's unique-effect bonus.
- **Max** earns a **Card Select Coupon** 🎟️ at a card's first 3★ — once per card ever, not once per scenario.
- A star pays **no tickets**: its run cost one, and the star is the reward (D148).

A card at 0★ pays 60% of a node, which is visible in the constellation as a dimmed node value. That gap is the entire
reason to bond.

### From limit breaks (save v7) and five stars (save v8)

Before save v7 a card held limit breaks 0–4. The migration turned each into `ceil(1.25 × LB)` stars — LB1 → 2★,
LB2 → 3★, LB3 → 4★, LB4 → 5★ — so no card lost node value or Race Bonus, and every maxed card stayed maxed.

Save v8 (D200) moves those five stars to three at `⌈3s / 5⌉`: 1★ → 1★, 2★ and 3★ → 2★, 4★ and 5★ → 3★. Rounding up
keeps every node percent a card had (old 2★ paid 76%, now 84%), and a card one star from the old max is maxed. A card
the migration maxes is paid its Card Select Coupon at startup if it never had one, and a Friendship Training run left
open on the five-star ladder is closed with its ticket refunded. The save field is now `bonds`, so a card on an older
scale can never be read without its conversion. A gold skill at a star threshold, once planned for bond 3, was never
built and is not part of stars.

## Where cards live on screen

- **The Cards tab** browses by lens — the collection, or one scenario ([Collection](collection.md#card-album)).
- **Each card's page** (`/cards/:id`) holds owning it, its stars in every reached scenario, and what it pays. Its type
  shows as the original's type icon on the illustration, its split with the stat icons, and a **Skills** list with the
  original's skill icons: its golds first, highlighted, then its whites, each marked with the node that pays it; a tap
  shows what the skill does and its base cost (D182).
- **Card tiles** carry the original's type icon in the corner, as the original and GameTora mark cards, and the
  original's stat icons stand for Speed, Stamina, Power, Guts and Wit on stat rows (the Uma profile, the Training
  header), with our own glyphs until content has them.
- **The Training scene's Card set tab** is where a scenario's six are chosen and bonded
  ([UX](ux.md#training-scene)).

Every Bond button opens Friendship Training, which returns to the screen it was launched from.
