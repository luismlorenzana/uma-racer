# Skills & Lineage

> All numbers are **draft values for tuning**. Skill data is seeded from the original game
> ([data backlog](../research/data-backlog.md)).

Skills and aptitudes both come from the active [constellation](constellations.md). Nothing here is rolled, and
nothing is frozen into a snapshot.

## Skill kinds

| Kind | Source | Draft SP cost | Notes |
|---|---|---|---|
| **Unique** | The Uma's own template | Free, always equipped | Her signature skill |
| **Inherited unique** | Lineage nodes | 200 (from the data) | A parent's or grandparent's unique, in its weaker inherited form |
| **Gold (rare)** | Card nodes · lineage nodes · her own awakening pair | 250–350 | An upgraded white skill |
| **White (normal)** | Card nodes · lineage nodes · her own kit | 90–180 | The common pool |

A lineage slot passes a template's **baseline whites, separately unlocked natural golds** and its **unique in inherited form** (D174, which
brings back what D123 removed). The inherited form is the original game's own record for it (`inheritedSkillId`),
with its own values: Seiun Sky's *Angling and Scheming* gives +0.2 acceleration for 2.4 s where her own gives +0.4 for
4 s. The engine takes those values as they are; it no longer halves them a second time.

## Where skills come from

Three deterministic sources, all recomputed rather than stored:

1. **Card nodes.** Each node a card occupies unlocks the **next of its golds**, while it has any left, and the **next
   of its whites** (D182). A card's whites are its `hintSkills`, in the pack's order; its golds are the golds among its
   `eventSkills`, in event order, because in the original a card's gold comes from its event chain and every hint skill
   is white. A card on four nodes pays four whites and up to four golds (most cards have one), so stacking a card is a
   skill decision as well as a stat one.
2. **Lineage nodes.** Each filled open parent or grandparent slot contributes that Uma template's baseline whites,
   separately unlocked natural gold positions (in awakening-gold order), and her unique in its
   inherited form. Choosing lineage is choosing skills: Seiun Sky lends any front runner her late-race corner
   acceleration.

3. **Her own kit** (D186). What she brings herself, as an original career does: her three **innate** skills and every
   skill her own **story events** teach (mostly whites), from her first scenario; and her four **awakening** skills in
   pairs, a white and a gold, the first pair from her first scenario and the second from her second. The Skills page
   shows a pair that is still closed, with the scenario it opens in, so nothing of hers is hidden.

Plus her **own unique**, which is permanent and free.

### Upper skills (D188)

A gold stands on its white, and a ◎ white on its ○, as in the original: Concentration on Focus, Right-Handed ◎ on
Right-Handed ○, and Right-Handed Demon on Right-Handed ◎. **Equipping a skill learns every skill below it in its chain**,
each is paid for once, and **only the highest learned skill of a chain races**; the gold is the improved version that
takes effect. So a gold costs its own SP plus its white's, unless the white is already equipped, and equipping the gold
takes the white's place. The white does not have to be in her library for its gold to be learned. A chain whose upgrade
no longer fits the SP she earns races its lower skill alone. 336 of 346 golds have a white in the data and all 65 ◎ have
their ○; the few that stand alone (Runaway and some scenario golds) cost only themselves. The Skills page prices each
skill with what it brings ("280 SP · with Focus") and marks a white learned through its gold as "Included in
Concentration".

Everything lands in the scenario's **skill library**, deduplicated. Removing a card removes the skills it was
paying for, in the same way it removes the stats.

## Skill Points are the only limit

SP is not spent and not earned per turn. It is a **capacity**:

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `spCap` | 2,000 | 2,400 | 2,800 | 3,000 | 3,200 | 3,400 | 3,600 | 3,800 | 4,000 | 4,200 | 4,400 | 4,600 | 4,800 | 5,000 |

Grounded where the original game is measured — Unity Cup careers finish around 2,000–2,500 SP and Trackblazer
around 2,800 (Game8) — and a draft elsewhere (D133). A typical gold with its white prerequisite costs about 340 SP
in our content, so tier 1 buys five or six.

**Training alone earns 40% of the cap by TL10**, a tenth of that per Training Level; **Friend and Group cards pay
the rest** ([Constellations](constellations.md#skill-point-cards)), and the total is clamped to `spCap`. The equipped **loadout**
must cost ≤ current SP. Swapping is free and instant outside races. If a reconfiguration takes SP away after skills
were equipped, racing does not stop: the equipped skills race in equip order while they fit, and the rest sit out
until the SP is back or they are unequipped (D132). An overdrawn loadout is never locked: any change that costs no more
than the loadout it replaces is accepted, so skills can always come off (D196); only a change that adds cost must fit.

So the loadout trade is direct and legible: a bigger library needs more slots spent on cards, and equipping
more of it needs nodes spent on a Friend or Group card. That is the whole economy of skills.

## Loadout

Skills have their own page, `/stable/:umaId/skills` (D175): the whole library with room to scroll, grouped as her
unique, inherited uniques, golds and whites, with search, filters (Equipped, Fits her, Inherited uniques, Gold,
White), each skill's source ("Lineage · Seiun Sky (parent)", "Card · Kitasan Black"), and the SP budget pinned at the
top. Skills that cannot work yet sit folded at the bottom. The profile shows only what she carries: her unique and the
equipped inherited uniques and golds, with the whites behind "All equipped" and a **Manage skills** link. The pre-race
sheet lists the equipped skills, greys the ones that cannot trigger on that course, and links to the same page with the
race in hand.

- Any subset of the library whose total cost is ≤ SP. The unique is free and always on.
- **Loadout presets**, for example "Long / Front" and "Mile / Late".
- The pre-race screen shows which equipped skills can trigger on this course.

The skill list shows each skill's **tags** and its description, and sorts the equipped skills first, then the ones she
can equip, then those waiting on later race mechanics.

### Skill tags

Tags are read off a skill's Global conditions and effects (`skillTags`, the same reading uma-planner uses), so they
need no authoring and track the data:

| Tag | From | Shown as |
|---|---|---|
| Running style | `running_style==1–4` | Front · Pace · Late · End, or **Any style** when neither style nor distance is set |
| Distance | `distance_type==1–4` | Sprint · Mile · Medium · Long |
| Surface | `ground_type==1–2` | Turf · Dirt |
| Phase | `phase`, its `_random` forms, and `phase>=` / `phase<=` ranges | Opening · Middle leg · Final leg · Last spurt |
| Place | corner, straight, final corner, final straight, hills, a bad start | Corner · Final straight · Uphill … |
| Effect | the effect ids the race engine reads | Speed · Acceleration · Recovery · Stats · Debuff … |

Style, distance and surface tags are tinted where the Uma's aptitude is A or better, so a list reads as "fits her" at a
glance. Names are the official Global names wherever the skill has shipped there (`name_en`); the community
translation of the JP name is only a fallback, and descriptions use Global terms for the running styles.

The library is scoped to the scenario. Unlocking the next scenario starts a fresh one, like everything else
about a [career run](constellations.md#a-scenario-is-a-career-run). Every skill ever learned is still recorded
in the **lifetime skill log** for badges and history.

---

## Lineage

Six slots — **2 parents, 4 grandparents** — opened individually with scenario Slot Tokens (D250). Each parent node is linked to
exactly two grandparent nodes and is detached from the card tree.

The [Global Uma RPG](uma-rpg.md#inspiration-rewards-d250) supplies two global Item families: slot and skill tokens.
No Training Level gate remains on lineage. Cards still open at TL1–8; TL9/10 still raise baseline stats and SP.

A slot holds a **reference to any Uma template the player owns**. Not a snapshot, not a trained instance:
templates never change, so nothing needs freezing and nothing can go stale (D123).

- The Uma herself is never eligible.
- The two parents must be different characters. A grandparent cannot be either parent or repeat a character on its
  own side. The **same exact grandparent outfit** may occur once on each opposite side, in either position; a
  different outfit of that character is not an eligible mirror.
- Slots are editable whenever they are unlocked, like every other node.

### What lineage pays

1. **Skills** — each filled open slot's whites and inherited unique, plus its separately unlocked natural golds.
2. **Aptitudes** — the only thing in the game that moves an aptitude grade.

### Independent unlocks and grandparent pricing (D250)

One **Inspiration Slot Token [Scenario]** opens one slot for one outfit in that scenario. A grandparent requires its
parent slot to be open (it need not be filled). One **Inspiration Skill Token [Scenario]** opens one of that slot's
two natural-gold positions; the slot must be open, filled and have that gold. Positions are indexed in awakening-gold
order, not keyed to a particular ancestor. Bought unlocks survive free replacements. Unlocking makes a skill
available; it does not equip it or waive SP. Own-kit and card availability is unaffected by a locked lineage moon.

An inherited unique or natural gold supplied only by a **single-side grandparent costs 2× SP**, including the gold's
entire prerequisite chain. The same grandparent outfit on both sides uses normal SP. Parent/own/card sources use
normal SP; a deduplicated skill uses its cheapest live source. Shared prerequisites are paid once at the cheapest
selected upgrade's rate; explicitly selecting a white cannot bypass a 2× gold. A baseline white selected without its
gold is normal price. Skills UI, budget validation and racing all use this same derived pricing. Mirrored
grandparents count as two filled aptitude slots but never duplicate a library or equipped skill.

Save **v14**, Dexie **v23**, persist only bounded `inspiration: { slots, golds }` alongside each scenario's assignments.
There are at most six existing slot ids and twelve `slot:gold0|gold1` keys. A −1 Item movement and precisely one
new unlock commit atomically through `spend-inspiration` with expected Uma/Item versions; pending/conflicted changes
are not spendable and ordinary edits to a reserved Uma/stack wait. No memory-only unlock or optimistic deduction.
Old rows retain A's three slots at TL9, both sides at TL10; an existing below-gate assignment retains its whole side.
Both gold positions of every grandfathered slot stay open, preserving availability without charges, grants or EXP
changes. Current explicit closed state never reopens merely because TL reached 10. Pure migration also handles cloud
adoption, is idempotent, and rejects malformed/future data instead of resetting it.

### Aptitude upgrades

For each of the ten individual aptitudes (turf, dirt · sprint, mile, medium, long · front, pace, late, end):

```
steps(a)  = max(0, |{ filled slots whose template grades a at A or S }| − 1)
result(a) = max( gradeIndex('A'), baseGrade(a) − steps(a) )
```

| Base | All six slots at A/S | Result |
|---|---|---|
| **F** | 5 steps | **A** — a perfect lineage can rescue an F |
| **G** | 5 steps | **B** — a G can never reach A, ever |

Upgrades are capped at **A**; **S is never granted**. One filled slot gives zero steps, so lineage has to be
built deliberately, and grades recompute live as slots change.

### What this replaces

Deleted: parent snapshots, the "must have completed a scenario" rule, automatic parent inheritance,
grandparent skill-picking, the inheritable-white and normalized-gold computation, pink sparks, the
circular-lineage merge rules, and the Scenario Start inheritance flow.

Owning more Umas is still exactly what makes lineage good, so the collection stays load-bearing — it is just
read from templates now instead of from frozen history.

## Temporary Inspiration advance (D256)

The owner's one-time advance opens **six lineage slots and twelve natural-gold positions** on every already-owned
outfit's existing scenario units, including unfilled positions. It selects no ancestors. Inherited Unique access is
part of the slot. Already-open and newly-opened positions both count: each unit owes **6 Slot and 12 Skill tokens**.
All four distance presets share these unlocks and charges; their builds, TL, careers and EXP remain unchanged.

The account has a separate, nonpositive balance for each scenario and token family, not negative spendable Items.
Existing Item stock stays untouched. Future RPG awards repay only the matching balance first; overflow becomes normal
inventory. A zero balance stays as the permanent one-time receipt. Later outfits and scenario units are not included.
Items and Inspiration show outstanding debt; chapter results show gross earned, repaid and deposited amounts.

The first updated online sync runs a protected, resumable server operation after queued work drains. Its frozen cohort
and per-outfit completion records prevent double charging on refresh, another device or an interrupted request.
Offline play never fabricates these unlocks; reconnect applies the acknowledged advance.

## Race engine impact

Skills are a core system, so race engine milestone **R2.5 (Basic skills)** comes before pack mechanics.
See [Racing](racing.md#race-engine-milestones).
