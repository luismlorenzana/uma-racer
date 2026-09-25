# Skills & Lineage

> All numbers are **draft values for tuning**. Skill data is seeded from the original game
> ([data backlog](../research/data-backlog.md)).

Skills and aptitudes both come from the active [constellation](constellations.md). Nothing here is rolled, and
nothing is frozen into a snapshot.

## Skill kinds

| Kind | Source | Draft SP cost | Notes |
|---|---|---|---|
| **Unique** | The Uma's own template | Free, always equipped | Her signature skill |
| **Gold (rare)** | Card nodes · lineage nodes | 250–350 | An upgraded white skill |
| **White (normal)** | Card nodes · lineage nodes | 90–180 | The common pool |

Inherited uniques are gone (D123): a lineage slot passes a template's **baseline golds and whites** only.

## Where skills come from

Two deterministic sources, both recomputed from the constellation rather than stored:

1. **Card nodes.** Each node a card occupies unlocks the **next** skill from that card's `hintSkills`, ordered
   gold-first, then white, then by skill id. A card on four nodes pays four of its skills, so stacking a card
   is a skill decision as much as a stat one.
2. **Lineage nodes.** Each filled parent or grandparent slot contributes that Uma template's four
   `awakeningSkillIds` — her baseline golds and whites. All 268 templates carry exactly four.

Plus her **own unique**, which is permanent and free.

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
until the SP is back or they are unequipped (D132).

So the loadout trade is direct and legible: a bigger library needs more slots spent on cards, and equipping
more of it needs nodes spent on a Friend or Group card. That is the whole economy of skills.

## Loadout

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

Six slots — **2 parents, 4 grandparents** — unlocked at Training Levels 9 and 10. Each parent node is linked to
exactly two grandparent nodes and is detached from the card tree.

A slot holds a **reference to any Uma template the player owns**. Not a snapshot, not a trained instance:
templates never change, so nothing needs freezing and nothing can go stale (D123).

- The Uma herself is never eligible.
- No two slots may hold the same character, including different outfits.
- Slots are editable whenever they are unlocked, like every other node.

### What lineage pays

1. **Skills** — each filled slot's four `awakeningSkillIds`, into the library.
2. **Aptitudes** — the only thing in the game that moves an aptitude grade.

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

## Race engine impact

Skills are a core system, so race engine milestone **R2.5 (Basic skills)** comes before pack mechanics.
See [Racing](racing.md#race-engine-milestones).
