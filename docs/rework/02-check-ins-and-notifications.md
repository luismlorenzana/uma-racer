# 02 · Check-ins, queues and notifications

> **Status: design for owner review, 2026-10-13 (D328, D334).** How the owner keeps 25 Umas working in visits of under
> a minute: Collect all, batch sizes, queues, Repeat, the check-in summary, the "what she still needs" planner, push
> notifications, offline time, retries and plain words. Numbers are drafts. `pnpm sim:loop`
> ([12](12-economy-and-pacing.md) §12) measures how much they raise utilisation.

The pacing target assumes about **75% utilisation**: each Uma works about 18 hours a day, with three check-ins and
queues ([12](12-economy-and-pacing.md) §11). Every idle hour between a job's end and the next visit is lost, so this
page's job is to shrink those gaps and make each visit fast.

This page owns the screens and conveniences. The pages it links to own the rules underneath:
- jobs, Recall, slots and worker rules: [07](07-farm.md);
- sessions and what each unlocks: [05](05-training-hub.md);
- recipes: [08](08-item-catalogue-and-recipes.md);
- Speed Tickets and Exchange prices: [09](09-racing-rewards-and-exchange.md);
- where buttons sit on the Hub: [11](11-hub-and-places.md).

## 1. A check-in in under a minute

| Step | Taps | Seconds |
|---|---|---|
| Open the Home Screen app (with push on, its badge already says how many Umas need a tap) | — | 3 |
| **Collect all · 14 ready** on the Hub | 1 | 2 |
| Read the summary (§4): what came in, who is free, what's blocked | — | 10 |
| **Repeat all (11)** | 1 | 2 |
| **Start suggestions (3)** for the free Umas (§6) | 1 | 5 |
| Put back one stopped queue, e.g. **Buy 2 and restart · 190** | 2 | 10 |
| Close | — | — |
| **Total** | **5** | **~30** |

Everything else (choosing a new recipe, bonding a card, racing) is optional at a check-in. The three check-in times
the sim assumes are **08:00, 13:00 and 22:30** ([12](12-economy-and-pacing.md) §12). The owner can change them in
Settings (§3).

## 2. Collect all

**One tap claims every finished item and unlock across the roster.**

- **Finished items of a running batch** are included. An Uma 3 items into a ×6 job gives up those 3 and carries on.
- **Finished unlocks** apply to the Uma's build at once: a node opens, a bond forms ([05](05-training-hub.md),
  [06](06-cards-and-bonds.md)).
- **Farm EXP** for the collected work is paid, with every Farm Level crossed ([07](07-farm.md)).
- **Queues advance** as if each entry had started on time (§3).
- It **never** restarts work, buys, sells or spends a Speed Ticket. Restarting is Repeat (§5).

It is **one `collect-all` operation** ([13](13-removals-and-plan-changes.md) §6) whose receipt has a line per slot
([07](07-farm.md) §9). A slot that can't be collected, for example because the other device already did, never blocks
the others, and its line says so. That receipt is what the summary shows (§4).

The Hub shows a floating **Collect all · N ready** button, where N counts Umas with something to collect. Each place
page has its own Collect for just that place.

## 3. Batch sizes and queues

### Sizing a job to the next check-in

Every job and session takes **1–10 items or unlocks, made one after another** (README). The size picker shows a chip
per size with **its finish time**, and how long the Uma would then wait for a check-in.

The owner's check-in times live in Settings: up to four times, by default 08:00, 13:00 and 22:30. The picker marks the
chip that ends closest before the next check-in (**Fits 13:00**). After the last check-in of the day it marks the one
for the morning (**Overnight**). It never picks for the owner. It preselects the marked chip, and one tap confirms.

Gaps at the default times, at grade 1 ([12](12-economy-and-pacing.md) §4 times):

| Work at grade 1 | 08:00 → 13:00 (5 h) | 13:00 → 22:30 (9.5 h) | 22:30 → 08:00 (9.5 h) |
|---|---|---|---|
| Gather (90 min each) | ×3, ends 12:30 | ×6, ends 22:00 | ×6, ends 07:30 |
| Craft (22.5 min each) | ×10 then ×3 queued, ends 12:53 | ×10, ×10, ×5 queued, ends 22:22 | ×10, ×10, ×5 queued, ends 07:52 |
| Cook (240 min each) | ×1, ends 12:00 | ×2, ends 21:00 | ×2, ends 06:30 |
| Session (180 min each) | ×1, ends 11:00 | ×3, ends 22:00 | ×3, ends 07:30 |

A chip that runs past the next check-in says so. For example, a ×2 session started at 08:00 shows "ends 14:00 · then
free until 22:30". Overshooting the next visit usually costs more idle time than stopping short of it.

### Queues

**Each Uma has her current job or session and up to 3 more queued behind it** (as uma-rpg's
[loops](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/game/loops.md#professions) do).

- **One slot, one place.** Queued entries run in the same slot at the same building or facility, with any recipe or
  unlock that place offers. A queue never moves her to another place ([01](01-game-loop.md) §2).
- **Each entry has its own recipe and size**, and the card shows the finish time after each one: "then Vegetables ×4
  → 17:30; then crafted Vegetables ×10 → 19:45".
- **A queued entry reserves nothing until it starts.** It starts at the moment the entry before it ends, taking its
  inputs from the Warehouse's free stock then ([07](07-farm.md) §2).
- **The card warns ahead.** A queued entry shows a warning mark ("short 2 raw Vegetables G2") as soon as the
  Warehouse, less what earlier entries will take, wouldn't cover it. The owner can fix it before the night, not after.
- **Starts are decided in time order across the whole roster**, as if each had happened on time, with ties by
  building order, then slot ([07](07-farm.md) §2). The result doesn't depend on which card the owner taps first, or
  on whether the app was open.
- **Stock that arrives later doesn't count backwards.** Outputs enter the Warehouse when collected. A queued entry
  that needed them at 06:00 found them missing, even if the owner collects them at 08:00.
- **An entry that can't be covered drops the rest of the queue** ([07](07-farm.md) §2, as in uma-rpg). The Uma is
  Free from that moment. The summary lists it under **Queue stopped** with what was short and a one-tap way to put it
  back (§4), and, if push is on, it counts her as free (§7).
- **Edit freely:** add, remove and reorder queued entries at any time. **Recall** stops the current entry and drops the
  whole queue ([07](07-farm.md)).

## 4. The check-in summary

Collect all opens the summary as a bottom sheet. The Hub's **Check-in** button opens the same sheet without
collecting. At 390 × 844 it reads top to bottom, with the primary action in the thumb zone:

```
 Check-in · since 08:02 (5 h ago)
 ─────────────────────────────────────────────
 Collected     41 items · 6 dishes · 5 unlocks
   Kitasan Black   Observatory node 11
   Gold Ship       Farm Lv 8 → 9 · grade 2 open
   3 queues moved on
 ─────────────────────────────────────────────
 Needs you
   Free (3)                    [Start suggestions]
     Mejiro McQueen  Gather Fruits G2 ×3 → 17:30
     Tokai Teio      Lineage Hall ×1 → 16:15
     Rice Shower     Cook Sweets dish G2 ×1 → 17:20
   Queue stopped (1)
     Special Week    Pantry ×10 at 06:00: short 2 raw Vegetables G2
       [Buy 2 and restart · 190]  [Start ×8]  [Make them: Garden ×2]
   Training done (1)
     Daiwa Scarlet   scenario 1 training complete   [Race]
 ─────────────────────────────────────────────
 Next: 14:10 Kitchen ×1 · all done by 22:05
 Prize Money 1,240 · Speed Tickets 18   [Speed up]
            [ Repeat all (11) ]
```

| Section | What it lists | One-tap fixes |
|---|---|---|
| **Collected** | Totals, then a line per notable change: unlocks, Farm Level-ups, new grades open, queues that moved on. Everything else folds into "41 items" | Tap a line to open that Uma or place |
| **Free** | Umas with nothing running or queued, each with the planner's suggestion (§6) and its fitted size | **Start suggestions** starts them all; tapping a line swaps it for another suggestion or opens the place |
| **Queue stopped** | Queues that dropped since the last visit: the entry that couldn't start, when, and which input was short by how many. The dropped entries are kept here so they can be put back | **Buy and restart**: buys the shortfall at the Exchange ([09](09-racing-rewards-and-exchange.md)) and restarts the entry with the rest of its queue. **Start ×8**: restarts it at the size the stock covers. **Make them**: starts the missing input with a free Uma, preselected and sized |
| **Couldn't repeat** | Jobs Repeat skipped (§5), with the reason: no inputs, layer done for that facility, no free slot ("Kitchen full") | The same fixes, or **Pick another** |
| **Training done** | Umas whose current scenario layer is complete | **Race**, which opens her next goal race |
| **Ready to advance** | Umas at the gate with their career complete ([03](03-uma-progression.md)) | **Advance**, with its usual confirmation |
| **Next** | The next finish, and when everything running will be done | — |
| **Money** | Prize Money and Speed Tickets on hand | **Speed up** (below) |

Empty sections don't show. A check-in with nothing to fix is just the Collected block and **Repeat all**.

### Speed Tickets at a check-in

Speed Tickets and their price belong to [09](09-racing-rewards-and-exchange.md). The check-in only offers fast ways
to spend them:
- **−30m** and **Finish** on any running card. Finish spends one ticket per started 30 minutes left, as uma-rpg does.
- **Speed up all**, which takes 1 h, 2 h or "to the next check-in" off every running job and session in one tap.
  Its confirmation shows the ticket count.
- **Best use** marks: the planner (§6) flags running jobs whose finish unblocks the most work, such as a Kitchen job
  three sessions wait on. These are the first to speed up after a free evening of racing ([01](01-game-loop.md) §5).

## 5. Repeat

**Repeat restarts a finished job or session with the same recipe and size, where the inputs allow.** It is on every
collected card, and the summary's **Repeat all** applies it to every Uma collected in this check-in.

| Case | What Repeat does |
|---|---|
| Inputs cover the same size | Starts it, reserving the inputs |
| Inputs cover fewer | Starts **the largest size they cover**, marked "×6 → ×3" in the summary. A smaller job beats an idle Uma |
| Inputs cover none | Skips it and lists it under **Couldn't repeat** with fixes |
| A gathering job | Always starts: gathering needs no inputs |
| A session at the Observatory, Lineage Hall or Gym | Starts the **next N unlocks** at the same facility and room, in her unlock order ([05](05-training-hub.md) §2) |
| A session at the Dojo | Skips, with **Pick cards**, which opens her Dojo sheet with the room chosen. Which card to bond is always the owner's choice ([06](06-cards-and-bonds.md)) |
| That facility is done for her open layers | Skips, with "Observatory done for this scenario" and the planner's next suggestion for her |
| Her Farm Level opened a higher grade | Keeps the same grade. The summary notes "grade 2 open" with a one-tap **Switch** for that Uma |
| She was recalled, moved or promoted since | Not repeated: a deliberate stop isn't undone |
| No slot free at that place | Skips, with "Kitchen full" and **Pick another** |

- **Size: same, or fit.** By default Repeat uses the same size. A toggle on the summary, remembered for the account,
  switches to **Fit to next check-in**: each restart takes the size the picker would mark (§3).
- **Collecting frees the slot** ([07](07-farm.md) §5, [05](05-training-hub.md) §2): Repeat takes any free slot at
  the same place. Collect all followed by Repeat all in one visit always finds them, since nobody else started in
  between.
- Repeat reads the **last finished entry** saved on her work row (§10), so it works on the next visit too, not just
  right after Collect.

## 6. The planner: "what she still needs"

Adapted from uma-rpg's farming targets ([D100](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/farm.md),
[loops "Targets"](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/game/loops.md#professions)) and today's Wishlist
([farm-kitchen-rework](../design/farm-kitchen-rework.md) §8).

### Targets

- **Up to 5 targets**, marked from an Uma's profile and shown with a crosshair in the Stable. Their order is the
  allocation order.
- **No targets marked: automatic.** The five Umas with the most unlocks left in their layers. This matches the sim's
  "furthest behind first" policy ([12](12-economy-and-pacing.md) §12). Marking any Uma switches the list to manual.
- **Any Uma, any time:** her profile's **Needs** tab runs the same plan for her alone, without changing the targets.

### What counts as a need

1. **Her remaining unlocks**, oldest layer first: anything left from earlier layers of this tier (under "from scenario
   1"), then the current layer. Older layers take cheaper dishes and lift her most per hour
   ([03](03-uma-progression.md) §10).
2. **The dish each one takes** ([05](05-training-hub.md), [08](08-item-catalogue-and-recipes.md)): a Vegetables dish
   for a node, a Mushrooms dish for Inspiration, a stat dish for a single Extra node or a bond, a Duo dish for a Duo
   node, a Feast for a Sun node.
   - A bond with no card chosen yet has no family, so it isn't cascaded. It shows as "3 bonds: pick cards".
3. **Each short dish's inputs:** 4 crafted of its family and grade, plus 1 crafted side
   ([08](08-item-catalogue-and-recipes.md)).
4. **Each short crafted item's raw item**, one for one.

### What counts first

At every step, before anything is "short":
1. **Warehouse stock**, less what queued entries will take when they start.
2. **Outputs coming** from running and queued work, including finished work not yet collected, in finish order.
3. Stock and outputs are **allocated once, in target order**: target 1 takes first. One dish is never promised to two
   Umas.

Reserved inputs of running work are already spent; the planner never counts them twice.

### What it shows

| Where | Shows |
|---|---|
| **Her Needs tab** | Layer progress (Observatory 8/12, Lineage Hall 1/2, Gym 4/10, Dojo 3/6), then the cascade: dishes short → crafted short → raw short. Then an estimate, "about 120 Uma-hours of work", and the three jobs that unblock her most, each with **Start** |
| **Each Farm site, the Pantry and the Kitchen** | **For your targets:** what the targets need from this place, lowest grade first. Each line reads "Vegetables G3 · short 6 · Warehouse 4 · coming 2 (Gold Ship, 14:10)". Tapping a line starts it in a free slot with the suggested Uma and a fitted size. The recipe picker badges target lines ("Target ×3") |
| **Each Training facility** | Per target: unlocks left here, dishes ready, dishes coming. **Start** when she's free and a dish is in stock |
| **The check-in summary** | Its suggestions for free Umas (§4) |
| **Roster view** | The planner's totals for every Uma's layer at once: unlocks left, dishes short by family and grade. Big-picture only; place lists stay with the targets |

**Grade gates and empty stock:**
- A line no free Uma can work says so: "Grade 4 needs Farm Lv 16 · highest free Uma: Lv 14". It offers **Buy at the
  Exchange** at its price when the Exchange stocks that grade ([09](09-racing-rewards-and-exchange.md) §5.3).
- On an empty Warehouse (a fresh account), every line is short. The suggestions start with gathering, which needs
  nothing.

### Suggestions for free Umas

For each free Uma, in order ([01](01-game-loop.md) §4):
1. **Her own session**, if a dish for one of her unlocks is in stock.
2. Otherwise **the scarcest line for the first target she can work**: her Farm Level must open the grade and a slot
   must be free.
3. **The size is fitted** to the next check-in (§3).

**Start suggestions** starts them all after a one-line preview each. The planner itself writes nothing: it is derived
on read from the save.

## 7. Push notifications: optional, and only uma-rpg's

**The owner's rule (D336):** push notifications are optional, and nothing outside what uma-rpg already set up. If they
come, they are **a port of uma-rpg's push** with the racer's few changes below. They aren't built unless the owner
asks for them after playing the new game ([13](13-removals-and-plan-changes.md) §4, phase 4). Everything else on this
page works without them: the check-in summary, Collect all, Repeat and the planner.

### What uma-rpg already has (ported as is)

uma-rpg's D63 and D65 ([decisions](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/decisions.md),
[sections, Global UI](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/game/sections.md#global-ui)):
- **A switch in Account** turns them on. Web Push works on iOS 16.4+ only in the Home Screen app, which is how the
  owner plays.
- **The API keeps subscriptions** in Firestore `push/{uid}`, outside the save, so a wipe never touches it.
- **Cloud Scheduler POSTs `/api/push/tick` every five minutes** with an OIDC token (uma-rpg's `scheduler.guard.ts`).
- **The tick reads the save** and announces what ended since the last check, judged by the real collect rules
  (uma-rpg's `save/notify.ts`), so a stopped queue stays quiet.
- **One notification** at a time: "Work done", or one that lists several ("N jobs done"). Tapping it opens the place.
- **The app badge** counts what's ready to collect; opening the app clears it.
- **VAPID keys** live in one Secret Manager secret. `infra/push/setup.sh` is copied and run once with the scoped
  gcloud configuration, never changing the active account.
- **The device side:** `push-sw.js` imported by the Workbox service worker, and the `NotificationsCard` in Settings.

**No new kind of infrastructure.** Cloud Scheduler and Secret Manager are the same pair uma-rpg runs for the same job,
set up the same way in the racer's project. They're needed because an iPhone Home Screen app can't schedule its own
notifications. Every piece sits in a free tier, as uma-rpg found: about $0, at most $0.10 a month for the scheduler
job if the billing account's free jobs are used up.

### The racer's changes

Only what the racer's rules need:

| uma-rpg | Uma Racer | Why |
|---|---|---|
| Announces Farm jobs | Also announces **Training Hub sessions** ("Training done") | Sessions are the racer's other timer |
| The badge counts ready slots | It counts **Umas** that need a tap: Ready or Free ([01](01-game-loop.md) §2) | The check-in thinks in Umas |
| The tick reads uma-rpg's single save document | It reads the racer's `work/*` rows ([13](13-removals-and-plan-changes.md) §6) and runs `@racer/domain`'s "what ended between" rule, the same code Collect runs | The racer's save is per entity |
| — | **Quiet hours** (default 23:00–07:30), with one morning notice if anything is still waiting | Overnight jobs end at night |
| — | Nothing is sent while the app is open | The owner is already looking |

That's the whole list. No reminders, no hold window and no extra notice types beyond uma-rpg's "Work done" and its
"N done" summary. If the owner later wants one of those, it's a small change to the same tick.

### Limits, said plainly

- **Work started offline is announced only after it syncs.** The device syncs on reconnect and on foreground.
- **A notice can arrive up to about five minutes after the work ends**, the scheduler's interval, as in uma-rpg.
- **Each installed copy subscribes separately** (iPhone and iPad are two). Removing the app from the Home Screen ends
  its subscription.

## 8. Offline and the clock

The rules are today's ([farm-kitchen-rework](../design/farm-kitchen-rework.md) §5,
[technical contract](../technical/farm-kitchen-implementation.md#4-semantic-operation-contract) §4,
[rearchitecture 05](../rearchitecture/05-farm.md) §4), applied to every job and session.

- **Timers derive from saved start timestamps.** An entry's *k*-th item or unlock ends at its start plus *k* item
  times, less the Speed Tickets applied ([09](09-racing-rewards-and-exchange.md)). The shared idle math (`uma-idle`)
  owns the formula. **Closed and offline time counts.**
- **Nothing runs while the app is closed, and nothing needs to.** On opening, the app recomputes every card from the
  timestamps. It applies queued starts in time order (§3), refreshes the badge and summary counts, flushes the outbox
  and pulls the other device's changes. While open, one minute clock that pauses when the app is hidden updates the
  labels, without writes.
- **Everything works offline:** Collect all, Repeat, starts, queue edits and races. They commit locally and sync later
  as operations ([rearchitecture 01](../rearchitecture/01-target-architecture.md) §4.3).
- **The trusted-device clock policy stays** (chosen by the owner on 2026-10-09):
  - each operation carries the phone's time, and the server checks the arithmetic, not the clock;
  - a clock moved forward makes work finish early, and one moved back makes it take longer;
  - progress never runs backwards or below zero;
  - there is no anti-cheat and no clock service. It's a personal game.
- **A second device adopts running work as it is,** with its original start, size and inputs. It never restarts a
  timer or picks new inputs ([farm-kitchen-rework](../design/farm-kitchen-rework.md) §15).
- **A day away costs time, not progress.** Finished work waits as Ready until collected, and queued entries that
  couldn't start wait (§3).

## 9. Retries, stale screens and plain words

### Never paid twice

- **Every tap is one operation with an id chosen before it's written.** A retried operation returns its first receipt
  and is never applied twice ([13](13-removals-and-plan-changes.md) §6).
- **A Collect all or Repeat whose answer was lost** is retried from the outbox with the same id. The server returns
  the first receipt, and the summary shows the same result. Nothing is paid, reserved or started twice.
- **A double tap does nothing.** The button is disabled while its operation is pending, and a second tap isn't queued.
- **Two devices:** if the iPad collected first, the iPhone's Collect all gets the server's state back. Its summary
  says "Already collected" on those lines. Nothing is shown as an error.

### A stale screen refreshes, it doesn't fail

A screen is stale when what it shows is older than the save, after a sync from the other device or time passing.

1. The action is **checked against the latest state**, with the same rules.
2. **Still makes sense:** it runs. Collect all collects whatever is ready now.
3. **Already done:** it shows that result ("Already collected: Fruits ×6") and refreshes.
4. **The owner's choice changed underneath** (the stock no longer covers the size they picked): it asks again in one
   sentence with the new numbers. "Only 3 left now. Start ×3?"
5. **Never** an instruction to reload, review or retry by hand.

This is today's D320 lesson. The owner couldn't assign a single worker past "Farm changed; reload and review the
current choices before confirming", and called the banners internal messages.

### Plain words

| Situation | Say | Never |
|---|---|---|
| Offline | "Saved on this phone. It'll sync when you're back online." | "Sync failed (503)" |
| Done on the other device | "Already collected." | "Stale revision", "conflict" |
| Stock changed | "Only 3 left now. Start ×3?" | "Farm changed; reload and review…" |
| A real rule | "Kitasan Black is busy until 18:30." · "Needs Farm Lv 16." | "bad-slot", "gate failed" |
| Short inputs | "Short 2 raw Vegetables G2." | "insufficient stock" |
| Anything unexpected | "That didn't work. Try again." (the outbox also retries by itself) | Codes, ids, stack traces |

- **Banned in player-facing text:** operation, receipt, revision, generation, version, stale, conflict, payload, id,
  sync error codes and HTTP numbers. A test checks the copy for them.
- **The only sync signal is today's Sync chip,** amber when changes have waited over a day, red on a real failure
  ([ux](../design/ux.md)).
- **Help sits behind an (i) button,** not in banners (uma-rpg D95's rule).

## 10. What's saved

| Where | What | Synced |
|---|---|---|
| `work/{outfitId}` ([13](13-removals-and-plan-changes.md) §6, [07](07-farm.md) §12) | Her current entry, up to 3 queued entries, **her last finished entry (for Repeat)**, and the last dropped queue with what was short, for the summary's **Queue stopped** until the owner restarts or dismisses it | Yes |
| `profile/main` | **Targets** (up to 5, in order); **check-in times** (up to 4); Repeat's same-or-fit choice | Yes |
| `operations` log | The `collect-all` and `repeat` receipts: the summary's source | Yes |
| Firestore `push/{uid}` | Subscriptions, notice settings, quiet hours and time zone, the tick's bookkeeping | Server only |
| Device storage (`uma-racer:g2:` keys) | When this device last showed the summary; collapsed sections | No |

The planner, suggestions, finish times and the badge count are **derived on read** and never saved.

## 11. Decided here

| Choice | Why |
|---|---|
| A dropped queue ([07](07-farm.md) §2) is kept on her work row and shown under **Queue stopped** with one-tap Buy and restart, Start smaller and Make them | The drop rule stays simple, and putting the queue back costs one tap |
| Queued entries warn as soon as the Warehouse wouldn't cover them | The owner can fix a shortfall before the night, not after |
| Queues stay in one slot at one place | One slot per Uma ([01](01-game-loop.md) §2) |
| Repeat shrinks to the largest size the stock covers, and flags it | A smaller job beats an idle Uma |
| Repeat keeps the size by default; "Fit to next check-in" is a remembered toggle | Same recipe and size is what the owner asked for; fitting is one tap away |
| Repeat on a session takes the next unlocks at the same facility and room ([05](05-training-hub.md) §2); at the Dojo it asks for cards | The same unlock can't be made twice, and which card to bond is the owner's choice |
| Repeat never upgrades a grade by itself; it offers **Switch** | No silent change to what a job makes |
| Default check-in times 08:00, 13:00 and 22:30, editable, up to four | The sim's policy ([12](12-economy-and-pacing.md) §12) |
| The size picker preselects the size that fits the next check-in, and shows the wait after each size | Overshooting a visit usually costs the most idle time |
| Planner targets: up to 5, in order; automatic (five furthest behind) until the owner marks one | uma-rpg's D100 limit; the automatic choice matches the sim |
| Unchosen bonds aren't cascaded; the planner asks for cards | A bond's dish depends on its card |
| Stock and outputs coming are allocated once, in target order; finished-but-uncollected output counts as coming | Never promise one dish twice, or spend what isn't collected |
| Push is optional and only a port of uma-rpg's D63/D65, built if the owner asks after playing (D336) | The owner's rule: nothing outside what uma-rpg already set up |
| The racer's changes are limited to sessions, counting Umas, reading per-entity rows, quiet hours and silence while the app is open | What the racer's rules need, and no more |
| A stale screen re-checks and runs, shows the earlier result, or re-asks with new numbers; never an error | D320 |

## 12. Done when

- **Under a minute:** on the owner's iPhone, with 25 Umas after a night away, opening the app, Collect all, Repeat all,
  Start suggestions and closing takes 60 seconds or less (owner check).
- **Collect all:** domain tests on a synthetic 25-Uma account show:
  - one operation claims every finished item and unlock;
  - a retry with the same id returns the same receipt, with nothing paid twice;
  - a second device's later Collect all reports "Already collected".
- **Queues** (domain tests):
  - a three-entry queue started at 22:30 runs through the night with the app closed;
  - queued starts come out identical whatever order the cards are collected in;
  - a queue that drops at 06:00 shows under Queue stopped at 08:00, and **Buy and restart** puts the whole queue back
    in one tap;
  - a queued entry the Warehouse wouldn't cover shows its warning before it starts.
- **Repeat** restarts every collected job at the same size; shrinks and flags when short; skips with a reason and a
  fix when empty; takes the next unlocks for a session; asks for cards at the Dojo; never repeats a recalled Uma.
- **Planner:** for synthetic targets, the need lines equal a brute-force recount, layer by dish by crafted by raw,
  less stock and outputs coming. No dish is allocated twice across five targets.
- **Push, if the owner asks for it:** uma-rpg's tests pass on the ported code; a session ending with the app closed
  gives one notice within about five minutes; nothing arrives in quiet hours or while the app is open; the badge
  matches the summary's count; and the billing report shows the push pieces at $0, or $0.10 at most.
- **Clock:** moving the phone's clock forward makes work Ready and its Collect is accepted by the API. Moving it back
  lengthens the wait and never shows negative progress.
- **Plain words:** a test fails if any player-facing string contains a banned word (§9), and the stale-screen cases of
  §9 each have a test that ends in a result or a one-sentence question, never an error.
