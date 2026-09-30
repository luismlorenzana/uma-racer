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
| **Wit** | MP and magical resource economy | A visible reason to value Wit on caster/hybrid builds. |

The conversion reads the outfit's **base racing stats and growths**, not its mutable scenario constellation or Produce
assignments, to keep this global profile stable when the player switches scenarios. The exact formula, HP source,
magical defense, caps, level curve, growth rounding and how class changes affect derived stats are deliberately
unfixed. The formula must use enough growth information that outfits do not become identical after their base stats
normalize, but cannot make a favorite race build mandatory for RPG play. Level-up gains are displayed as a before/after
snapshot; any random variation must be seeded and replayable, not rolled by the screen.

EXP comes from resolved battles and possibly chapter completion. A lower-level participant should catch up faster and
an overleveled one should receive less EXP from weak enemies; no one gets EXP merely for opening a map or abandoning a
fight. The relative-level formula, KO participation rule, level cap and chapter-replay policy require simulation.

## Class, weapon and aptitude identity

Each outfit chooses **one RPG class from the running styles for which it has A aptitude**. Multiple A styles are
alternatives, not simultaneous class counts. A class can be changed between chapters or at a safe checkpoint if the
final respec policy allows it; an in-progress battle never changes class. No role is mandatory in a party.

| Running-style class | RPG role | Weapon choices | Expected strengths |
|---|---|---|---|
| **Front — Guardian** | Defensive physical anchor | Sword + shield | Guard, intercept, physical attacks, defensive buffs. |
| **Pace — Vanguard** | Flexible physical damage | Spear **or** axe | Reliable strikes, stagger/armor pressure, situational party support. Two weapons give the large Pace pool variety. |
| **Late — Arcanist** | Magical damage and support | Tome **or** staff | Tome favors offensive spells; staff favors healing/buffs while retaining damage. |
| **End — Spellblade** | Physical/magical hybrid | Spellblade | Attacks that combine or switch physical and magic pressure; tactical finishing, not mandatory sustain. |

The owner's **10% class-specialization bonus** is a draft rule: one chosen weapon and one chosen signature element get
the bonus in their applicable action calculations. It should not stack twice on a hybrid's same damage component.
Exact eligibility, rounding and whether it boosts damage, accuracy or another action outcome need a combat sim and a
pinning test. Two A styles do not grant two simultaneous class bonuses. Weapon restrictions are class identity;
element access is set by distance/surface aptitudes separately.

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
Likewise, an outfit with no A style or a chapter roster with no viable End must still have an explicit rule and warning,
not an empty picker. Class/element candidates come from the outfit's source aptitudes, not its editable racing defaults.

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

## Five-member combat proposal

A five-member party is the leading design, not a class quota. A natural team can be **one Front guardian, three
Pace/Late flex slots and one End spellblade**, but a five-Pace challenge party or a team with no End remains legal.
The actual role balance must be measured against the owned launch roster; the research shows only one starter End-A
outfit, so mandatory End would make the mode unnecessarily restrictive. Four-versus-five mobile readability is an
explicit prototype gate before the save schema commits to five.

The core turn reads: inspect visible enemy composition/intent → choose an acting Uma → Attack, Skill, Guard or Item
(only if a later item policy defines battle consumables) → resolve with visible weakness and defenses → enemy action →
repeat. The player can target deliberately. Physical and magical damage, MP costs, healing, buffs, debuffs and KO
states are required categories; skill definitions and numeric effects are separate balancing work. Each skill must
state target, element, physical/magical type, MP cost, magnitude, duration, stacking and what happens on resistance.

The first combat slice should prove: a Front guard can protect allies, Pace has two meaningfully different weapon
plans, Late tome/staff have both damage and recovery, End uses both ATK and MATK without double dipping, and every
element's weakness matters. Persona's extra-action-on-weakness is a promising **candidate**, not a decided rule: if
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
- Ordinary enemies can be synthetic monsters for the engine and tests; private authored production packs may use
  PriConne guest characters for named encounters/bosses, based on the owner's preference. Their names, art, battle
  kits and rows stay in private content, not git. Missing or outdated private content is surfaced clearly.
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
