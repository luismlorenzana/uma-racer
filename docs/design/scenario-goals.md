# Scenario Goals

Each Uma gets **target achievements for every scenario**, shaped by her aptitudes and the real horse's
identity. Goals give each scenario a story: a Long runner chases the Arima Kinen, a filly chases the Triple Tiara.
Goals are **optional, but prominently displayed** as badges and profile flair.

> Race names are real JRA/NAR races. Distances should be verified when the race catalog is built.

## Goal slots per scenario

| Slot | Source | Example |
|---|---|---|
| 1. **Aptitude goal** | Her best distance or surface aptitude | Long A → win the Arima Kinen |
| 2. **Identity goal** | Real-horse sex, or a signature race of the real horse | Male → Satsuki Sho, the first leg of the Triple Crown |
| 3. **Challenge goal** | A stretch objective | Win a Mile race with B aptitude or lower · win by 5+ lengths |

## Goal pools

### By aptitude (distance or surface at A or higher)

| Aptitude | Signature targets |
|---|---|
| Sprint | Takamatsunomiya Kinen (1200) · Sprinters Stakes (1200) |
| Mile | Yasuda Kinen (1600) · Mile Championship (1600) · NHK Mile Cup (1600) |
| Medium | **Triple Crown races** · Japan Cup (2400) · Takarazuka Kinen (2200) · Tenno Sho Autumn (2000) · Osaka Hai (2000) |
| Long | **Arima Kinen (2500)** · Tenno Sho Spring (3200) · Kikuka Sho (3000) · other Long races |
| Dirt | February Stakes (1600) · Champions Cup (1800) · Tokyo Daishoten (2000) |

### By real-horse identity

| Identity | Targets |
|---|---|
| Male | **Triple Crown:** Satsuki Sho (2000) → Tokyo Yushun (2400) → Kikuka Sho (3000) · Asahi Hai Futurity Stakes |
| Female | **Triple Tiara:** Oka Sho (1600) → Yushun Himba (2400) → Shuka Sho (2000) · Victoria Mile · Queen Elizabeth II Cup · Hanshin Juvenile Fillies |
| Signature | The real horse's famous wins, seeded per Uma (for example a Japan Cup winner gets the Japan Cup) |

**Aptitude check:** an identity goal is only assigned when the Uma has **B or better** at that race's distance and
surface. Otherwise the next option in the pool is used, so a male Sprinter isn't pushed into Kikuka Sho.

## Escalation across tiers

| Tier | Goal difficulty |
|---|---|
| 1 | Win a Debut/Maiden race · win an OP race in her best category |
| 2 | G3 wins in her category |
| 3 | G2 wins in her category |
| 4–6 | **G1 wins.** Series goals are spread across tiers (for example tier 4 Satsuki Sho, tier 5 Tokyo Yushun, tier 6 Kikuka Sho) |
| 7+ | **Titles** (Triple Crown within one scenario, Autumn Triple Crown), repeat G1 wins, high-margin wins, off-aptitude G1 wins |

Every race is open from scenario 1 (see [Racing](racing.md#all-races-open-from-scenario-1)). The escalation only shapes the *goals*, so early goals stay achievable while higher-grade fields are still tough.

## Optional, but very visible

Goals **never block promotion**. What they give instead is **prominent flair**: a completed goal should feel like a
bigger moment than an ordinary badge, and a missed one should stay visible.

### Where goals show up

| Place | What it shows |
|---|---|
| **Uma profile: Scenario Journey strip** | One medallion per scenario tier, each with **3 goal pips** (filled when completed, hollow when missed). The **Honors crest** replaces the medallion when all 3 are done |
| **Race picker** | Races that count toward an active goal are pinned to the top with a **goal ribbon** |
| **Pre-race screen** | A "🎯 Goal race" banner showing which goal is at stake |
| **Results screen** | A dedicated **goal-complete fanfare**, bigger than badge popups |
| **Trophy case** | A **Goal Ribbons** shelf: every completed goal becomes a named ribbon, for example *"Arima Kinen · Grand Masters goal"* |
| **Flair timeline** | Goal completions are highlighted entries |
| **Uma Album** | Honors crest count on each Uma's tile |

### Timing

- A goal counts **only within its own scenario**. After promotion, unfinished goals are marked **missed**: the hollow pip stays on the Journey strip as honest history.

## Rewards

| Completion | Reward |
|---|---|
| Each goal | **Goal Ribbon** badge |
| All goals in a scenario | **"[Scenario] Honors"** badge and crest |
| Identity series completed (Triple Crown / Triple Tiara) | The matching **title** (see [Badges](badges.md)) |
| Many goals across scenarios | **Destiny** tiered badge. On the account: **Stable Goals** and **Honors Collector** achievements (see [Collection](collection.md)) |

## Data needed

- `realHorseSex` and `signatureRaces` for every Uma template.
- A race catalog with grade, distance, surface, venue, and series membership.
