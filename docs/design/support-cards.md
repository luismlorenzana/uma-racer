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

- **Owning** is account-wide. Cards come from the starter set or from Card Select Coupons
  (see [Collection](collection.md)).
- A **card set** is per Uma, **per scenario** (D125): **six slots**, era-gated to that scenario's tier, drawn
  from owned cards. Six everywhere — the old 4/5/6 tier ramp is gone.
- No duplicate card and no two cards of the same character in one set.
- **Limit breaks are shared across all Umas** — one copy per card, so breaking a card improves it everywhere.
- One of the six slots is the scenario's **dedicated slot**, which pays Skill Points instead of stats
  ([Constellations](constellations.md#the-scenario-slot)).

The card set decides what the scenario's **card nodes** may hold. Slotting a card into the set does nothing on
its own — the card only pays once it occupies nodes.

## What a card is worth

Almost everything a card used to do lived in the training turn, which no longer exists. What remains:

| Property | Effect |
|---|---|
| **Type** | how a card node distributes its value ([table](constellations.md#what-a-card-node-pays)) |
| **Limit break** | scales every node the card occupies: LB0 0.60 → LB4 1.00 |
| **Tilt** | a small per-card shift of the primary/secondary split (below) |
| **`hintSkills`** | which skills the card pays into the library, one per node it occupies |
| **Race Bonus** | **Uma EXP from races** while the card is in the active set, from LB1 |

Deleted with the training turn: Training Bonus, Friendship Bonus, Specialty Priority, Hint Frequency, Stat
Bonus, and Initial Stats. There is no card EXP.

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

Friend and Group cards have no primary, so their tilt is always 0 and they always pay 0.20 to each stat. Their
value is breadth: one Friend card covers five stats where a Speed card covers two.

## Limit breaks

A card advances **one limit break per [Bond Recall](minigames.md#bond-recall--card-limit-breaks) clear**. That
is the only way. Its level is derived:

| Limit break | LB0 | LB1 | LB2 | LB3 | LB4 (MLB) |
|---|---|---|---|---|---|
| Level | 5 | 10 | 15 | 20 | **25 = maxed** |
| Node multiplier | 0.60 | 0.70 | 0.80 | 0.90 | **1.00** |

- **LB1** activates Race Bonus.
- **LB3** adds a gold skill to `hintSkills`, so a broken card pays better skills as well as more stats.
- **LB4** maxes the card and earns a **Card Select Coupon** 🎟️, once.
- Each advance grants **+10 training tickets**.

A card at LB0 pays 60% of a node, which is visible in the constellation as a dimmed node value. That gap is the
entire reason to play Bond Recall.

## The card album

The Cards album is one of the two [collection](collection.md) surfaces and gets the same treatment as the
Stable: dense icon grid, reserved detail area with the full 450×600 illustration, filters and sorts, and
default sort owned → era newest → limit break highest.
