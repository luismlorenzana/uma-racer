# Global Uma RPG — reference and roster research

Research for the [Global Uma RPG first draft](../design/uma-rpg.md), reviewed 2026-09-30. This is a proposed account-level,
turn-based campaign with owned Uma outfits as party members. It is not a claim that the mode, chapter content, or rewards
exist in the app today.

## Which references fit?

| Reference | Useful observation | Adaptation | Do not copy |
|---|---|---|---|
| [Persona 5 Royal](https://persona.atlus.com/p5r/index.html) | Targeting an enemy weakness is a visible tactical payoff and can grant another action. | Show enemy affinity and intent, make a weakness hit tactically meaningful, and let party composition create deliberate chains. The exact extra-action rule needs simulation. | Calendar, social links, dungeon length, Persona fusion, or its characters/assets as checked-in data. |
| [Fire Emblem Heroes](https://fire-emblem-heroes.com/en-gb/beginners) | Phone-friendly team presets, a readable matchup triangle, and less EXP for defeating weaker foes. | Saved party presets, a clear elemental legend and pre-battle matchup preview, with level-relative RPG EXP. | Gacha, stamina, grid movement, PvP, or mandatory one-of-each classes. |
| [Octopath Traveler II](https://www.square-enix.com/asia/newsportal/en/sg/octopathii/) | Jobs, weaknesses and the Break/Boost rhythm make every member's role legible. | A possible future guard-break meter and meaningful weapon/element coverage. | Its full job system and the complete Break/Boost economy in v1. |
| [Fire Emblem Heroes skill sets](https://new-guide.fire-emblem-heroes.com/en-US/feh-2230.html) | Saved equipment/skill configurations reduce between-battle menu friction. | Five named Uma-party presets and an explicit skill-setup checkpoint after a fight. | Automatic equipment changes that silently alter an already-started fight. |

The **best initial combination** is Fire Emblem Heroes' compact preset and matchup presentation, Persona's weakness
payoff, and a chapter map with meaningful branches. Break meters and multi-stage combo systems are later candidates,
not prerequisites for the first playable loop.

## What the private Uma roster actually says

Aggregate only, computed from the existing local private Uma pack on 2026-09-30. An outfit is counted once in every
aptitude where it has grade **A**, so these columns overlap. The sample is 268 outfits / 135 characters; the starter
subset has 25 outfits. No private rows or extracted identifiers are reproduced here or added to git.

| A aptitude | All outfits | Starter outfits |
|---|---:|---:|
| Front | 47 | 5 |
| Pace | 161 | 16 |
| Late | 136 | 13 |
| End | 37 | 1 |
| Sprint | 34 | 4 |
| Mile | 101 | 8 |
| Medium | 214 | 19 |
| Long | 103 | 10 |
| Turf | 251 | — |
| Dirt | 23 | 1 |

The concern about Pace/Late double counting is real: **69 of the 136 Late-A outfits also have Pace-A**. Of those, 66
have exactly Pace+Late; seven of the thirteen starter Late-A outfits also have Pace-A. Exact style masks in the full
pack are: Pace only 72, Pace+Late 66, Late only 46, Front only 27, Late+End 20, Front+Pace 19, End only 13, and six
spread across three rarer combinations. Counting Pace and Late as two distinct armies would exaggerate choice. The
design should let a dual-A Uma **choose one role** without forcing a party quota. End is particularly scarce among
starters; a mandatory End slot would make party building brittle.

Medium-A is common (214/268), so giving Medium two distinct elements is a strong variety lever. However, **element
access is not equivalent to elemental power**: whether Medium also gets the best spell tier should wait for a skill
catalog and encounter simulation. The proposed distance→element mapping is the owner's intended starting point, not a
fact about the source game.

## Enemy identity and art

The owner prefers to explore *Princess Connect! Re:Dive* (PriConne) rather than a generic monster pack. Cygames'
[official character directory](https://priconne-redive.jp/character/) and
[official anime character list](https://anime.priconne-redive.jp/archive/1st/character/) are starting points for
selecting recognizable guest opponents; the latter lists, among others, Pecorine, Kokkoro, Karyl, Yui, Miyako, Jun,
Christina and Tomo. Cygames' [game help](https://dmg.priconne-redive.jp/help/) distinguishes physical and magical
attack/defense, which is useful when researching how a guest might *feel* in combat. The first authored roster should
separate ordinary encounter foes from named guest/boss encounters, so a path does not require fighting the same named
character repeatedly. Which characters, alternate forms, abilities and exact art to use remain a private-content
authorship decision, not invented facts in this doc.

The personal-only nature of Uma Racer does not change its repository rule: extracted names-as-data, images, sprites,
packs and caches stay under gitignored `/content/` or script caches, never in git. Checked-in fixtures must be small
and synthetic. The design and tests must work with a synthetic enemy catalog before any PriConne pack is available;
production must say when a private chapter pack is missing rather than silently substituting unrelated fights. A
[CC0 monster-builder pack](https://kenney.nl/assets/monster-builder-pack) exists as an optional visual fallback for
original placeholder encounters, not as a replacement for the owner's chosen direction.

## Research conclusions

1. Lead with **five party slots** as a proposal: one Front guardian, several interchangeable Pace/Late attackers or
   casters, and an optional End hybrid is viable; no slot is hard-typed. Test five against four at 390×844 before
   locking the count.
2. Make weakness, enemy intent, weapon, element and recovery readable before the action. Strategy should not depend
   on memorizing an unseen chart.
3. Keep the map and battles short enough to resume on a phone. A chapter can be a long-term campaign without making
   every individual encounter a long session.
4. Keep this mode's levels and EXP per outfit, global across all parties/chapters, and do not turn it into a second
   source of racing or Training EXP.
