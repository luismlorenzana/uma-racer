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
| `effectProfile` | Now feeds only the **tilt** (below) |
| `hintSkills` | The skills this card pays into the library through card nodes |
| `icon`, `art` | Local asset references only |

## Ownership vs. the card set

- **Owning** is account-wide. Cards come from the starter set, from **tickets** (`25 + 5 × era`), or from a Card
  Select Coupon, all on the card's own page (see [Collection](collection.md#unlocking-cards)).
- **Power belongs to a scenario.** A card's bond (0–4) and the nodes it fills are per scenario; nothing about a card's
  strength is account-wide. The UI calls a limit break a **bond** and shows no card level (D130).
- A **card set** is per Uma, **per scenario** (D125): **six slots**, era-gated to that scenario's tier, drawn
  from owned cards. Six everywhere — the old 4/5/6 tier ramp is gone.
- No duplicate card and no two cards of the same character in one set.
- **Limit breaks belong to a scenario, and are shared by every Uma racing there** (D127). Breaking a card in
  URA Finale improves it for every Uma in URA Finale; in Unity Cup that same card starts at LB0 again. So the
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
| **Type** | how a card node distributes its value ([table](constellations.md#what-a-card-node-pays)) |
| **Limit break** | scales every node the card occupies: LB0 60% → LB4 100% |
| **Era** | scales every node against the *scenario*: current era 100%, −5 points per era older, floor 40% |
| **Tilt** | a small per-card shift of the primary/secondary split (below) |
| **`hintSkills`** | which skills the card pays into the library, one per node it occupies |
| **Race Bonus** | **Uma EXP from races** while the card is in the active set, from LB1 |

Deleted with the training turn: Training Bonus, Friendship Bonus, Specialty Priority, Hint Frequency, Stat
Bonus, and Initial Stats. There is no card EXP.

**Era is what makes a newer card better** (D126). Two Speed cards of the same type hand you the same kind of
skills and the same stat split; the newer one pays more per node. Because the penalty is measured against the
scenario rather than in absolute terms, an old card fades as an Uma climbs tiers without ever becoming
worthless, and the tree budget stays the ceiling at every tier.

### Tilt

Two max-broken Speed cards should not be interchangeable. Each card's `effectProfile` generates one number:

```
tilt = clamp(−0.10, +0.10, (statBonusWeight − trainingBonusWeight) × 0.25)
```

which shifts its distribution toward its primary stat by `tilt` and away from its secondary by the same amount.
A Speed card at tilt +0.08 pays Speed 0.78 / Power 0.22 instead of 0.70 / 0.30.

**The row still sums to 1.0**, so the [invariance rule](constellations.md#the-invariance-rule) is untouched.
Tilt changes the *shape* of a card, never its size — a specialist and a generalist are both worth exactly one
node's value.

Friend and Group cards have no primary, so their tilt is always 0. They pay skill points rather than stats
(D132); their value is the loadout they buy.

## Bond (limit breaks)

On screen a limit break is a **bond**, 0 to 4, and there is **no card level** (D130). A card advances **one bond
per [Bond Recall](minigames.md#bond-recall--card-limit-breaks) clear**, in the scenario that run named. That is the
only way.

| Bond | 0 | 1 | 2 | 3 | 4 (Max) |
|---|---|---|---|---|---|
| Node multiplier | 0.60 | 0.70 | 0.80 | 0.90 | **1.00** |

- **Bond 1** activates Race Bonus.
- **Bond 3** is meant to add a gold skill to `hintSkills`, so a bonded card pays better skills as well as more
  stats. *Not implemented yet*: today each node a card fills pays the next skill on its list, whatever its bond.
- **Max bond** earns a **Card Select Coupon** 🎟️ — once per card ever, not once per scenario.
- Each advance grants **+5 training tickets**.

A card at Bond 0 pays 60% of a node, which is visible in the constellation as a dimmed node value. That gap is the
entire reason to play Bond Recall.

## Where cards live on screen

- **The Cards tab** browses by lens — the collection, or one scenario ([Collection](collection.md#card-album)).
- **Each card's page** (`/cards/:id`) holds owning it, its bond in every reached scenario, and what it pays.
- **The Training scene's Card set tab** is where a scenario's six are chosen and bonded
  ([UX](ux.md#training-scene)).

Every Bond button leads to Bond Recall, which returns to the screen it was launched from.
