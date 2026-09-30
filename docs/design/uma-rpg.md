# Global Uma RPG — first design draft

> **Status: proposal, not implemented.** The owner has fixed the mode's global scope, outfit-specific RPG levels,
> Speed-as-offense mapping, visible weapon/element identity, and inventory-only destination for its future rewards.
> Party size, encounter math, leveling curve, exact skill catalog, chapter length and reward quantities are *drafts or
> open questions*. This document must be resolved and pinned before any engine/save migration is implemented.

The [research](../research/uma-rpg.md) compares phone RPG references and measures the overlapping Uma aptitudes.
This mode is a fourth, self-contained account activity reached from Home, beside Farm, Collection/Racing and Training.
It uses owned Uma **outfits** as a persistent RPG roster, five saved party presets, branching chapter maps and
turn-based battles. Its progression is deliberately independent of race Uma Level, per-scenario Training Level,
Farming Level and support-card stars.

## The player loop

```text
Home → RPG hub → choose a party preset → choose any chapter → preview route/level warning
     → choose a path node → fight with five owned outfits → result + RPG EXP
     → level-up reveal → adjust RPG skills at a safe checkpoint → choose next path
     → boss → chapter-clear reward enters global Items
```

- The hub opens directly on the player's saved RPG state; it does not ask for a featured Uma first. Its internal
  navigation is **Map · Parties · Roster · Items/Records** (names provisional). No sixth bottom tab.
- Five named presets are account-wide quick configurations. A preset saves member order, the chosen class/weapon,
  signature element and RPG skill loadout for each slot. The first-pass proposal disallows duplicate outfits; whether
  two outfits of the same character may coexist remains open. An empty or partial preset is editable but cannot launch
  a five-member chapter.
- Any preset may choose any chapter. Recommended RPG level and expected enemy elements are shown; a low-level party
  gets a warning, not a hard gate. The chapter's progress belongs to that **preset's run**, so switching presets does
  not erase another preset's place on its map. The proposal permits one open chapter per preset; starting a different
  one requires an explicit finish/abandon rule, never a silent overwrite. RPG levels earned by an outfit remain global
  across all presets.
- The map branches around enemy compositions and tactical tradeoffs, not random hidden doors. G1 race names, distance
  bands and surfaces may theme map nodes and suggest their enemy mix, but these are RPG encounters: they do not run the
  race engine, mark race goals, or pay racing EXP.
  A path reconverges before a named boss. Chapter length, number of fights and replay rewards are not yet fixed.
- After a fight, the result shows each participating outfit's RPG EXP, new level, stat changes and newly available
  skill slots/tiers in a Fire Emblem-like reveal. The player can open skill setup before choosing the next map node.
  Chapter clear pays only its defined RPG reward; any scenario-linked Parent Unlock item goes straight to the global
  Item inventory. How such an item is later consumed is **outside this design** and must not be inferred here.

## Outfit RPG profile and progression

An owned outfit has one RPG level/EXP pair shared by every preset and chapter. Different outfits of the same character
have different RPG levels, as in Farm; there is no scenario-specific RPG copy. An RPG profile shows its class, chosen
weapon, active element, available element affinities, skill slots, level/EXP and combat attributes. Only the RPG area
shows RPG Level. Racing and Farm values are read as inputs where specified, never mutated by RPG fights.

| Existing Uma input | RPG attribute it informs | Intent |
|---|---|---|
| **Speed** (base stat + growth) | **Physical ATK and magical MATK** | The owner's core mapping: Speed is the main race-winning stat, so it should drive both offensive routes. |
| **Stamina** | Initiative / action speed, with HP or endurance contribution to be decided | Stamina enables longer efforts in racing; it should not quietly replace Speed as the primary damage stat. |
| **Power** | Physical DEF, guard strength | A sturdy physical role. |
| **Guts** | Dexterity / critical reliability | Precision and clutch effects, not another raw ATK stat. |
| **Wit** | MP and magical resource economy | A visible reason to value Wit on caster and support builds. |

The conversion reads the outfit's **base racing stats and growths**, not its mutable scenario constellation or Produce
assignments, to keep this global profile stable when the player switches scenarios. Level-up gains are deterministic,
never a hidden random stat roll. A class or weapon switch changes the available actions, not the outfit's earned
RPG EXP or five core-stat history. This lets a dual-A outfit try another role without rerolling favorable growths.

### First balance candidate: levels and stats

This is a **simulation candidate, not an approved tuning pin**. It gives implementation planning a concrete curve to
test against a fourteen-chapter campaign without pretending that battle payouts or chapter lengths are settled.

| Measure | Candidate rule | What the player sees |
|---|---|---|
| RPG Level | Starts at 1, caps at **50**, per owned outfit | Level and EXP bar in RPG only; never changes race Uma Level or Farming Level. |
| EXP to next level from current level `L` | `100 + 18L + 2L²` for `1 ≤ L < 50` | 120 from Lv1→2, 480 from Lv10→11, 1,260 from Lv20→21, 5,784 from Lv49→50; 107,800 total to Lv50. |
| Core RPG stat `s` at level `L` | `round(B_s / 5 + (L − 1) × 1.5 × (1 + G_s))`, where `B_s` is the outfit's base racing stat and `G_s` its stored fractional growth rate (`0.2` means +20%) | Five permanent core values are **derived**, not accumulated as mutable rolls. The level-up panel compares exact old/new values. |
| Combat projection | ATK/MATK from RPG Speed; initiative and part of HP from RPG Stamina; PDEF/guard from RPG Power; dexterity from RPG Guts; MP/support capacity from RPG Wit | The equipped weapon's physical/magical channel decides which offensive value is used. A Greatsword cannot use MATK just because it is computed. |

For a **synthetic** outfit with base Speed 100 and stored Speed growth `0.2`, RPG Speed would read 20 at Lv1,
22 at Lv2, 36 at Lv10 and 108 at Lv50. The result panel would show `Speed 20 → 22`, then recalculate ATK and
MATK from the new value; only the equipped weapon's channel is usable in that battle. This example is invented for
the draft, not copied from a private Uma row.

HP, MP, magical defense and the damage formula still need their own simulation; they must derive from the five core
values without making Speed the answer to every defense or heal. Candidate pacing is about one early level per two
level-matched encounters and one late level per six to eight; the exact encounter/chapter EXP and level-relative
catch-up multiplier are **not** set. Lv50 may take replaying chapters rather than only their first clear. If the sim
cannot make that a satisfying long-term destination, change the formula and this table before code lands.

EXP is awarded after a resolved battle to the participating outfits and optionally at chapter clear, with one
idempotent grant per encounter/clear. A lower-level participant should catch up faster and an overleveled one should
receive less EXP from weak enemies; no one gets EXP merely for opening a map or abandoning a fight. A KO'd member's
participation rule and repeat-clear reward need explicit decisions. The result first applies EXP, then shows each
crossed level in order, its five core-stat deltas, changes to HP/MP/ATK/MATK/etc., and every new skill row or slot.

### First balance candidate: skill progression

Attack and Guard are always available and **do not consume equip slots**. Each weapon has a neutral basic action, a
starter technique, later utility and elemental techniques. Leveling unlocks *eligible blueprints* automatically;
equipping remains a deliberate between-battle choice. No duplicate skill grind or separate RPG skill currency is
proposed. A and B aptitudes determine which element tiers a blueprint may take, while weapon choice determines what
the action actually does.

| RPG Level | New options (candidate) | Equipped active-skill slots |
|---|---|---:|
| 1 | Chosen class/weapon, neutral basic action, Rank I elemental technique from eligible affinities | 2 |
| 5 | Class utility: Greatsword guard-break, Spear target mark, Paladin protect, Wizard area control, Cleric restoration, or Tome mark | 3 |
| 10 | Rank II elemental evolutions; one more simultaneous technique | 4 |
| 15 | Second weapon-specific utility or combo setup; no mandatory menu interruption | 4 |
| 20 | Rank III weapon × element combinations; broad build-defining effects | 5 |
| 30 | Sixth slot so a multi-element outfit can carry more coverage/support | 6 |
| 40 | Rank IV capstone for **A-grade** element affinity only; B stays through Rank III | 6 |
| 50 | Level cap and mastery presentation; no seventh slot or unseen damage jump | 6 |

When several levels are crossed in one result, all unlocks appear together but the screen names each level. A new
skill does not silently replace an equipped one. If the loadout is full, it becomes **Available** in the RPG profile
and the result links to skill setup. An active battle keeps its frozen level/loadout; newly earned levels apply at
the next safe checkpoint. Tier thresholds and slot counts above must be tested for menu burden and role parity.

## Class, weapon and aptitude identity

Each outfit chooses **one style-class from the running styles for which it has A aptitude**, then **one weapon path**
within that class. Multiple A styles are alternatives, not simultaneous class counts. Pace chooses Spear *or* Sword +
shield; Late chooses Wizard *or* Cleric staff; no one dual-wields both paths in battle. A class/weapon path can change
between chapters or at a safe checkpoint if the final respec policy allows it; an in-progress battle never changes.
No role is mandatory in a party.

| Running-style class | RPG role | Weapon choices | Damage and support identity |
|---|---|---|---|
| **Front — Breaker** | Physical-only heavy attacker | **Greatsword** | Heavy single-target and cleave hits, armor pressure, elemental martial finishers. No magical-damage actions. |
| **Pace — Lancer or Paladin** | Physical offense **or** physical support | **Spear** or **Sword + shield** | Spear favors repeated hits and marks; sword/shield guards allies, buffs defenses and heals while retaining physical attacks. |
| **Late — Wizard or Cleric** | Magical offense **or** magical support | **Wizard staff** or **Cleric staff** | Wizard has elemental burst/area control; Cleric has offensive buffs and healing with a modest magical attack. |
| **End — Tome Mage** | Magical-only specialist | **Magic tome** | Spell chaining, marks and elemental finishers. No physical-damage actions. |

The owner's **10% specialization bonus** remains a draft rule: the selected class weapon and one signature element
receive it in their applicable action calculations. It must not double-count one elemental action. Exact eligibility,
rounding and whether it boosts damage, accuracy or another action outcome need a combat sim and a pinning test. Two A
styles do not grant two simultaneous class bonuses. There is no End-only fallback, penalty or special party rule;
End follows the same aptitude, level, element, slot and reward contracts as Front, Pace and Late. Weapon identity comes
from the selected running-style class; element access comes from distance/surface aptitudes separately.

### Distance and element proposal

| A distance | Elements offered as signature/skill affinity |
|---|---|
| Sprint | **Dark, Light** |
| Mile | **Ice, Light** |
| Medium | **Fire, Dark** |
| Long | **Lightning, Light** |

Every A distance contributes both listed affinities, so a multi-A outfit can have more than two elements. Grade **A**
should permit the highest tier of that element's skill line; **B** should permit most lower tiers but not the capstone.
The signature element selects the **portrait overlay and specialization bonus**, not a one-element spell limit:
the outfit may equip skills from every eligible affinity, subject only to the RPG skill slots/tier rules. The exact B
set and tier ladder await the skill catalog. Turf/Dirt also matter: their grade determines whether the
distance-derived affinity is full strength on a chapter's matching surface, or whether a narrower off-surface version
is allowed. This is *not yet defined*; do not ship the table as distance-only and silently ignore surface aptitude.
An outfit with no A style still needs an explicit general fallback rule before implementation; it must not see an
empty class picker. Class/element candidates come from the outfit's source aptitudes, not editable racing defaults.

The elemental relationship is:

```text
Fire > Ice > Lightning > Fire
Light ↔ Dark (each weak to the other)
Light/Dark ↔ Fire/Ice/Lightning (neutral both ways)
```

The triangle direction above is a **provisional** choice; no advantage multiplier is fixed. The combat UI always
shows a text/glyph legend, target weakness/resistance and projected effect. Color is an extra cue, never the sole cue.
Medium's Fire/Dark pair deliberately gives a large Medium roster two different matchup families; it does not yet grant
a higher damage coefficient or an extra skill tier.

### Weapon × element skill matrix

**Damage channel and element are separate axes.** Front and Pace basic attacks are neutral **physical** hits; Late
and End basic attacks are neutral **magical** hits. An MP-costing Greatsword Flame Rend is still a physical strike: its
elemental portion changes matchup/status, but the whole action uses ATK and physical defense. It is not secretly a
MATK spell. Likewise a Tome Fire Sigil uses MATK and magical defense. Paladin and Cleric healing/support spend MP but
do not turn their basic damage channel into the opposite type. This is how every weapon gains elemental play without
erasing the owner's physical-only Front and magical-only End identities.

At Rank I, every permitted weapon/element pair has a simple infused attack or support technique. Rank II strengthens
its element's status/utility; Rank III introduces the pair's **combo identity** below; Rank IV is an A-affinity
capstone version, not a second unrelated element. The matrix is a *design vocabulary*, not 30 copied source-game
skills or a promise to author 30 unique animations. The example names below are invented and provisional. The six
weapon templates and five element modifiers should compose into many combinations, while combat coefficients are
domain rules to simulate, document and pin; checked-in tests use synthetic actors.

| Weapon path / neutral baseline | Fire — Burn / pressure | Ice — Slow / control | Lightning — Chain / tempo | Light — Ward / cleanse | Dark — Drain / weaken |
|---|---|---|---|---|---|
| **Front Greatsword** · heavy physical cut | Flame Rend: physical cleave with burn addendum | Frost Rend: physical cut that delays target intent | Storm Rend: physical hit with secondary chain target | Dawn Rend: physical hit that breaks a hostile ward | Night Rend: physical hit that weakens the next enemy attack |
| **Pace Spear** · repeated physical thrust | Ember Lance: successive strikes intensify burn | Rime Pin: strike and slow a marked target | Arc Lance: repeat hit jumps to marked foe | Beacon Lance: expose target for an ally | Shade Lance: strike and reduce target offense |
| **Pace Sword + shield** · physical strike/guard | Ember Aegis: guard, then retaliate physically | Ice Bastion: guard plus stronger defense buff | Thunder March: guard plus ally initiative buff | Mercy Ward: defend and heal an ally | Gloam Ward: defend and blunt enemy offense |
| **Late Wizard staff** · magical bolt | Fire Bloom: magical burst/area burn | Winter Field: magical area slow | Chain Spark: magical jumps across targets | Sunray: magical hit against wards | Umbral Hex: magical hit plus resistance debuff |
| **Late Cleric staff** · small magical bolt/heal | Warmth: ally healing over time plus attack buff | Shelter: heal plus damage mitigation | Quickening: heal plus initiative buff | Benediction: focused heal and cleanse | Veil: restorative drain plus enemy weaken |
| **End Magic tome** · magical sigil | Cinder Script: stack, then detonate burn | Glacier Script: accumulate control for a seal | Volt Script: charge then chain damage | Halo Script: puncture a dark ward | Eclipse Script: mark then drain/finish |

These are **six weapon paths**, each with five elemental evolutions. The element's global motif remains consistent,
while the weapon changes target pattern and role. A skill card shows weapon, element, channel, rank, MP, target,
projected damage/heal, status/duration and affinity gate. For a multi-element outfit, any eligible skills can fill
its slots together; the signature element only chooses the specialization bonus and portrait badge. A single action
may use one element, never two advantages at once; a combo skill can require a visible setup mark or ally action but
must be deterministic and previewed. The first simulator should compare all six paths across neutral, advantaged,
disadvantaged and Light/Dark matchups, including whether healing/support crowds out offense.

A physical elemental technique should display a **physical base + an elemental rider**. Both portions use ATK against
physical defense; only the rider receives elemental advantage/resistance and its status effect. A magical elemental
technique uses MATK against magical defense and applies its element to the spell. This gives a Front an MP-spending
physical-plus-Fire attack without a hidden second MATK hit. Healing and buffs use their own support formulas; their
element changes the rider (for example Light cleansing or Lightning initiative), not the caster's damage channel.
For example, a Greatsword Fire line might evolve from one burning cut at Rank I, to a more reliable burn at Rank II,
to a burn-consuming cleave at Rank III, to an A-only finishing strike at Rank IV; an Ice Wizard line evolves from a
single slow bolt to area control. Rank upgrades must have new tactical choices, not only larger numbers.

## Five-member combat proposal

A five-member party is the leading design, **not a class quota**. A natural team can be **one Front Greatsword, three
Pace/Late flex slots and one End Tome Mage**, but neither Front nor End is mandatory; a five-Pace challenge party is
legal. The owner will acquire more End outfits normally—there is no End-specific exception or filler system.
Four-versus-five mobile readability remains an explicit prototype gate before the save schema commits to five.

The core turn reads: inspect visible enemy composition/intent → choose an acting Uma → Attack, Skill, Guard or Item
(only if a later item policy defines battle consumables) → resolve with visible weakness and defenses → enemy action →
repeat. The player can target deliberately. Physical and magical damage, MP costs, healing, buffs, debuffs and KO
states are required categories; skill definitions and numeric effects are separate balancing work. Each skill must
state target, element, physical/magical type, MP cost, magnitude, duration, stacking and what happens on resistance.

The first combat slice should prove: Front Greatsword is strong but strictly physical; Pace Spear and Paladin have
different physical plans; Late Wizard and Cleric have distinct magical offense/support; End Tome is strictly magical;
and every element's weakness matters. Persona's extra-action-on-weakness is a promising **candidate**, not a decided rule: if
five actors can chain indefinitely, fights become trivial. Prototype a bounded follow-up or momentum action and
compare it with no extra action. Enemy intent is revealed before commitment; no hidden reroll after reload.

Combat rules are pure TypeScript in `packages/domain`; presentation can use React for menus and PixiJS only if a scene
actually benefits from many animated actors. Rules consume a frozen encounter/content version, deterministic seed and
player actions. The screen animates the engine's result, never decides it. Persist enough state/action evidence to
restore the same turn and targets after a reload. Distinguish a **synced chapter checkpoint** from a device-local open
battle; a second-device/reinstall policy must be decided before implementation. A resolved encounter and its EXP/item
reward must be idempotent, with no way to claim twice by navigating back or reconnecting.

## Chapters, content and reward boundary

- A chapter selects one of the existing scenarios as theme/reward destination. Every preset may launch any chapter;
  its recommended level, surfaces, dominant elements and boss are visible first. An authored path has branches, regular
  fights, optional recovery/setup points and a boss. The map is not a set of actual races that alter race history.
- A chapter run freezes its chapter definition and membership/class/weapon/element at start. **Skill loadouts may be
  edited only between battles**; each battle freezes the loadout that entered it. Level-ups earned elsewhere while a
  preset is open must not retroactively alter a frozen battle. Exact behavior for the next checkpoint is a technical
  design question, not license to discard the new EXP.
- Ordinary enemies can be synthetic monsters for the engine and tests. The [PriConne research](../research/uma-rpg.md)
  now separates **ordinary monster encounters** (for example a magical multi-target hound versus a physical thief
  fork) from **named guest/sparring encounters** (a physical frontline guest, magical debuffer, support or barrier
  specialist). A first private chapter should prove both lanes and a composition-dependent path choice before
  multiplying content across scenarios. Exact names-as-data, art, battle kits and rows stay in private content, not
  git. Missing or outdated private content is surfaced clearly; no unrelated silent fallback duel.
- Chapter rewards may include a scenario-typed **Parent Unlock item** (working name). This is an item stack plus an
  append-only ledger grant in the existing global Item inventory, transactionally coupled with chapter-clear evidence.
  **This draft defines no consumption, constellation node effect, required amount, or per-run quantity.** The separate
  Inspiration design will own that bridge. Do not pay a Badge-page achievement instead of an inventory item.
- The RPG never pays Training EXP, race Uma EXP, Farm XP, race goals or card stars unless a later decision explicitly
  changes that boundary. It also does not spend a Training Ticket by default; the campaign's entry economy is open.

## Phone presentation

At 390 × 844, the hub has one resume card per active preset, a prominent chapter/party action, and compact Roster and
Items links. The party setup uses five legible cards rather than five tiny portraits across one row. **Every RPG Uma
portrait, including map/party/combat/result variants, carries small visible overlays for its equipped weapon and
active element**: glyph plus short text/accessible label, with a toggleable affinity legend. The overlays cannot cover
the face or rely on two similar colors. The RPG profile makes outfit identity and RPG Level unambiguous.

The battle stage keeps the current target, HP/MP, intent and weakness visible; actions occupy the thumb zone with
44 pt targets and `pb-safe`. The active fight does not page-scroll. Map and roster menus may scroll normally. Use
`m.*` under `LazyMotion strict`, transform/opacity animations and delta-timed effects; respect reduced motion. The
route and any PixiJS scene stay lazy so startup remains ≤180 KB gzip. A short in-mode guide uses the existing paged
guide pattern and explains class choice, elemental triangle, Light/Dark, MP, resume and reward destination.

## Relationship to existing systems and delivery order

This is a **persistent global campaign**, like Farm in scope, not a ticketed `MinigameHost` run. The shared
[Minigame kit](minigame-kit.md) supplies useful standards—pure engine, deterministic replay, private content,
mobile safe areas, guide, result clarity—but its one-ticket reservation, 64-action journal and unsynced terminal
run lifecycle cannot simply be imposed on a multi-fight chapter. The design must explicitly define its own save and
sync contract before implementation. Farm already owns global Items; the RPG uses the same stacks and ledger, not a
second reward wallet. M027's Inspiration minigame is separate; nothing here overrides its TL/lineage policy.

The proposed sequence is deliberately **not yet numbered into implementation tasks** while concurrent work is in
flight and the gates below remain unresolved:

1. **Rules and save contract:** settle party count, aptitude/surface eligibility, level/stat curves, combat model,
   chapter checkpoints, cross-device behavior and item identity; pin constants and synthetic fixtures.
2. **RPG roster and presets:** global hub, five named presets, outfit profiles, class/weapon/element setup and portrait
   overlays, with complete reload/sync tests.
3. **Battle vertical slice:** pure deterministic engine, one synthetic encounter per role/element, phone battle UI,
   skill/guard/heal/debuff mechanics, resume and idempotent result.
4. **Map and content:** branch/reconverge chapter engine, versioned private enemy packs, level warnings, boss, guide
   and readable battle previews. Production content is a separate private publish.
5. **Progression and inventory:** RPG EXP/level-up reveal/skill slots, preset checkpoint resume, scenario item grant into
   global inventory, conflict/replay simulations and full chapter balance.
6. **Device acceptance:** 390×844 and small-iPhone screenshots, VoiceOver/reduced-motion, background/reload/offline,
   long chapter, party switching, clear/retry and owner physical-iPhone sign-off.

The full milestone should get task IDs and one PR per delivery slice only after the unresolved rules are decided.
Implementation must then update this design doc, append decisions, pin each numeric rule in
`packages/domain/src/domain.test.ts`, and run lint, test, build and a dedicated RPG simulator.
