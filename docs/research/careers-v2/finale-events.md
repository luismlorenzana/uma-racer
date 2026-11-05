# Careers v2 · The URA Finals as an announced course

> **Status: proposal (2026-11-05),** added to [careers v2](README.md) before its build began. Decision **D395**
> amends D390's point 8. Packets: [T164](../../tasks/T164-race-conditions.md) (the conditions in the race engine) and
> [T162](../../tasks/T162-distance-groups-and-calendars.md) (the event in the career).

## The feedback

The owner, 2026-11-05: "In the actual uma-musume game, there's these 2 concepts of Champions Meetings and League of
Heroes, where they are announced with the 'Track' and then the distance type and actual distance, and then variable
conditions for each event. Can we have the Finale event to be focused on that Track approach? i.e. Tokyo 2000m, Chukyo
Racecourse 1200m and so on?"

## What the original does

Both events are announced ahead of time as one course and its conditions, and trainers build an Uma for that course:
- the racecourse, the surface, the distance (its type and its metres), the direction, and inner or outer;
- the season, the weather and the ground.

Every round of the event runs on that course. What makes a build good there is the course itself:
- her aptitude for the surface and distance;
- the skills that fire on that track, direction or kind of distance;
- the skills that fire in that season, weather or ground;
- how the ground changes her stats.

We take the format, which is the announcement and building for it. We don't take the events' names or their
schedules: ours are named by their course, and nothing runs on a clock.

## The design

### 1. Each career's URA Finals are one announced course

- **The event:** a course and its conditions:
  - **racecourse**, **surface** and **distance** in metres with its type;
  - **direction** (left, right, or straight), and inner or outer where the course has both;
  - **season**, **weather** and **ground**.
- **Every round runs on it:** the qualifier, the semifinal, the final, and the Finale's Furlong Hand prep heat.
- **It's announced at career start** and frozen with the career, so the whole career builds toward it, as a Champions
  Meeting build does. It shows on the Start career sheet, the career header, the calendar's Finale chip, Upgrade and
  the Finals' race sheet.
- **This replaces** D390's point 8, where she picked the Finals' distance at the Finale. The course is known from the
  first season instead.
- **Each event is a real G1's course,** named on its card ("the Tenno Sho (Autumn) course"), so it resolves against the
  catalogue as the calendars do (by public name and metres, [careers v2](README.md) §2.4). The rounds' fields stay
  today's: G2, G1, and the final's 10% handicap.

### 2. The event board: a fixed list per calendar

Each calendar has its own board. The conditions follow the real race's month, with the weather and ground spread so
every board holds firm, good and wet going.

**The season here is the original's skill season,** by month: spring March–May, summer June–August, autumn
September–November, winter December–February. It isn't the calendar's season grouping, which keeps June in Spring
([careers v2](README.md) §2.1). The card says the season the skills read.

**Medium · Long (turf):**

| # | Course | Distance | Direction | Season | Weather | Ground | The G1 it's modelled on |
|---|---|---|---|---|---|---|---|
| 1 | Tokyo · Turf | 2400 m · Medium | Left | Spring | Sunny | Firm | Tokyo Yushun (Japanese Derby) |
| 2 | Nakayama · Turf | 2500 m · Long | Right, inner | Winter | Cloudy | Good | Arima Kinen |
| 3 | Kyoto · Turf | 3200 m · Long | Right, outer | Spring | Sunny | Firm | Tenno Sho (Spring) |
| 4 | Hanshin · Turf | 2200 m · Medium | Right, inner | Summer | Rainy | Soft | Takarazuka Kinen |
| 5 | Kyoto · Turf | 3000 m · Long | Right, outer | Autumn | Sunny | Firm | Kikuka Sho |
| 6 | Tokyo · Turf | 2000 m · Medium | Left | Autumn | Cloudy | Good | Tenno Sho (Autumn) |

**Mile · Medium (turf):**

| # | Course | Distance | Direction | Season | Weather | Ground | The G1 it's modelled on |
|---|---|---|---|---|---|---|---|
| 1 | Hanshin · Turf | 1600 m · Mile | Right, outer | Spring | Sunny | Firm | Oka Sho |
| 2 | Tokyo · Turf | 2400 m · Medium | Left | Spring | Cloudy | Good | Japanese Oaks |
| 3 | Kyoto · Turf | 2000 m · Medium | Right, inner | Autumn | Sunny | Firm | Shuka Sho |
| 4 | Tokyo · Turf | 1600 m · Mile | Left | Spring | Rainy | Soft | Victoria Mile |
| 5 | Kyoto · Turf | 1600 m · Mile | Right, outer | Autumn | Sunny | Firm | Mile Championship |
| 6 | Hanshin · Turf | 2000 m · Medium | Right, inner | Spring | Cloudy | Good | Osaka Hai |

**Sprint · Mile (turf):**

| # | Course | Distance | Direction | Season | Weather | Ground | The G1 it's modelled on |
|---|---|---|---|---|---|---|---|
| 1 | Chukyo · Turf | 1200 m · Sprint | Left | Spring | Sunny | Firm | Takamatsunomiya Kinen |
| 2 | Nakayama · Turf | 1200 m · Sprint | Right, outer | Autumn | Sunny | Good | Sprinters Stakes |
| 3 | Tokyo · Turf | 1600 m · Mile | Left | Spring | Sunny | Firm | NHK Mile Cup |
| 4 | Kyoto · Turf | 1600 m · Mile | Right, outer | Autumn | Rainy | Soft | Mile Championship |
| 5 | Hanshin · Turf | 1600 m · Mile | Right, outer | Winter | Cloudy | Good | Asahi Hai Futurity Stakes |
| 6 | Chukyo · Turf | 1200 m · Sprint | Left | Spring | Rainy | Heavy | Takamatsunomiya Kinen, in the wet |

**Mile · Medium on dirt:**

| # | Course | Distance | Direction | Season | Weather | Ground | The G1 it's modelled on |
|---|---|---|---|---|---|---|---|
| 1 | Tokyo · Dirt | 1600 m · Mile | Left | Winter | Sunny | Firm | February Stakes |
| 2 | Ohi · Dirt | 2000 m · Medium | Right | Winter | Cloudy | Good | Tokyo Daishoten |
| 3 | Chukyo · Dirt | 1800 m · Mile | Left | Winter | Sunny | Firm | Champions Cup |
| 4 | Ohi · Dirt | 2000 m · Medium | Right | Summer | Rainy | Heavy | Teio Sho |

Each course is checked against the content's courses: the racecourse, surface, metres, direction, and inner or
outer. A board is a table in code with a live block in the manual, and adding an event is one row.

### 3. Who gets which event

- **Eligible:** the board's events at a distance she runs in her group, on her surface. For a single-distance Uma
  ([careers v2](README.md) §1.4), that means only her A distance.
- **The default is the board's next event in turn:** the eligible event at position *n* mod the eligible count, where
  *n* is the number of careers already started in that calendar. It's derived from the save, so nothing new is
  stored, and the owner's careers walk the board without a clock.
- **The owner can pick another** eligible event on the Start career sheet. Choosing stays the owner's, as everywhere
  in the game.
- **The event is stored on the career** (`CareerRecord.finale.event`, its board row's id) and never changes.

### 4. What the conditions do in a race (T164)

Today the engine reads the ground as Firm and the weather as Sunny for every race (`FIXED_GROUND_CONDITION`,
`FIXED_WEATHER`), and it doesn't model the season. T164 makes all three race inputs:

- **The ground** changes her stats and her stamina use, as in the original:

  | Ground | Turf: Speed | Turf: Power | Turf: HP use | Dirt: Speed | Dirt: Power | Dirt: HP use |
  |---|---|---|---|---|---|---|
  | Firm | 0 | 0 | × 1.0 | 0 | −100 | × 1.0 |
  | Good | 0 | −50 | × 1.0 | 0 | −50 | × 1.0 |
  | Soft | 0 | −50 | × 1.02 | 0 | −100 | × 1.01 |
  | Heavy | −50 | −50 | × 1.02 | −50 | −100 | × 1.02 |

  The HP column is [race mechanics](../race-mechanics.md)'s. The stat column fills the "table to research" left open
  there. These are the community-documented values, and **T164 checks them against the sources before pinning them.**
- **Season, weather and ground** are skill conditions, as in the original:
  - 21 skills in the content read the season, 12 the weather and 22 the ground;
  - today they can't fire, so they can't be bought ([05](../../game/05-the-build.md) §8);
  - with T164 they race and can be bought;
  - the 120 skills that read the track and the 11 that read the direction already work, and so does the
    standard-distance check.
- **The course's stat check:** each course in the content lists `statThresholds`, the stats the original's course
  rewards. The engine doesn't read them yet. T164 researches the original's rule and builds it if the sources confirm
  it. If they don't, T164 records why in its decision and leaves the field unread.
- **Calendar races** run at their real month's season, sunny, on firm ground, so season skills fire there too. Only
  the Finals vary the weather and the ground. Varied conditions for calendar races are a later call, if the owner asks
  for them.
- **Rivals** race under the same conditions and with the same modifiers.

### 5. On the screen

- **The Start career sheet:**
  - the group, then the Finals' course from the eligible board, the default preselected;
  - each event is a card, "Tokyo · Turf 2000 m (Medium) · Left · Autumn · Cloudy · Good", with its icons, the G1
    it's modelled on, and a strip of the course (its straights, corners and slopes from the content, as Furlong Hand
    draws its legs).
- **Throughout the career:**
  - the event is a chip in the career header and on the calendar's Finale;
  - the preset of the event's distance is marked "Finals" ([careers v2](README.md) §3).
- **Upgrade → Skills** gains a **For the Finals** filter: the skills whose conditions the course meets (its track,
  direction, distance type, standard or not, season, weather and ground).
- **The Finale:**
  - the race sheet repeats the course and conditions;
  - Furlong Hand's prep heat runs the event's course;
  - the ground doesn't change Furlong Hand's rules in this release.

### 6. Code

| Where | Change |
|---|---|
| `packages/race` | `RaceInput` gains `conditions: { ground, weather, season }`; the ground's stat and HP modifiers; the condition variables read them; the engine version goes up; and the course stat check if T164 confirms it |
| `race-skills.ts` | `season` joins the course variables; skills reading the season, weather or ground stop being unsupported, so the build's "no effect in races" rule lets them be bought |
| `career/races.ts` | A calendar race passes its month's season, sunny, firm |
| **`career/finale-events.ts`** (new) | The four boards; `eligibleEvents(group, surface, aptitudes)`; `defaultEvent(save, calendar)`; `eventRace(event, races)` resolves the G1's course |
| `career/finale.ts` | `finaleRace` reads the career's event; the Finals pass its conditions; `set-finals-distance` isn't built |
| `career/start.ts`, `save/records.ts` | `start-career` takes `finaleEvent`, defaulting to `defaultEvent`, and refuses an ineligible one in words; `CareerRecord.finale.event` |
| `stages/config.ts` | The Finale's prep heat runs the event's course |
| `career/sim.ts` | Each career's Finals on its default event in turn; prints the Finals' first tries by ground |
| `career/docs.ts` | Live blocks: the boards and the ground table |
| `apps/web` | The event cards on the Start career sheet; the header chip; the Finale chip; the For the Finals filter; the race sheet's conditions |

### 7. What `sim:careers` holds

- The URA Finals' final: 40%–60% first-try wins across all events, as today.
- No board event under 30% or over 70% for a median deck at a distance she's A in. A wet event that's a wall is
  retuned by its row's conditions, not by a multiplier.
- `sim:balance` adds a ground column: each style's win share on firm and on heavy, for the record.
