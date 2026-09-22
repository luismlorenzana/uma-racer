# Milestone 7 — Align and stabilize

**Outcome:** the shipped game matches the design it was built from, the private content it needs is actually published,
and the installed app on the owner's iPhone reliably runs the current code against the current content.

Milestones 1–6 delivered the content pipeline, the local-first progression loop, race depth, cards and collection,
scenario progression, and the badge pillar. A full alignment review on 2026-09-19 (see the findings below) found
that three agreed rules never reached production and that two agreed systems were deferred without a home. Milestone 7
closes the alignment gaps and makes releases dependable. It adds no new pillars.

## Why this comes before the rest

The original roadmap put Polish at #7. That order changed (D105): presentation polish is worth little while goals ignore
a rule we agreed on, titles cannot be earned at all, and three scenarios are missing. The owner also reports that the
game currently "leans a bit towards unplayable", so Milestone 7 reserves a task for the playability notes that follow
their own playthrough, and presentation polish moves to [Milestone 9](M009-look-and-feel.md) and beyond.

## Findings this milestone closes

| # | Finding | Task |
|---|---|---|
| 1 | Race-set titles (Triple Crown, Triple Tiara, the four Queens, Grand Tour) can never be earned: the private series override was never created, so published content carries zero series tags | T019 |
| 2 | Goal-plan v1 dropped the agreed real-horse-sex identity rule (D23) with no superseding decision, and goals are always single races | T020 |
| 3 | JP scenarios 12–14 were missing, leaving the Uma level cap and late card eras behind JP | T021 (complete) |
| 4 | Publishing private content is an undocumented manual step, and an installed app can sit on an old shell with no update signal | T022 (complete) |
| 5 | The owner's own playability notes | T023 |

The later D119–D125 redirection superseded the old scenario-modifier milestone. Friend/Group cards remain ordinary broad
supports in the constellation model; scenario shapes, crests, buffs and the carried-over race/badge gaps now live in
[Milestone 15](M015-scenario-identity.md).

## Sequence

```text
T019 race series legs and earnable titles     (code delegable; Claude publishes the private file)
        │
        ▼
T020 scenario goals v2: career and sex identity   (complete)
        │
        ▼
T021 JP scenarios 12–14                            (complete)
        │
T022 release, content publish, and update readiness   (complete)
        │
T023 playability pass                              (to be defined from owner notes)
```

T019 came first because T020's series goals and the title badges both read the same private series legs. Its private
override is published. T022 does not depend on the gameplay tasks and landed as the shared release path.

| Task | User-visible result | Must not absorb |
|---|---|---|
| T019 (complete and published) | Triple Crown, Triple Tiara, Spring/Autumn Triple Crown, the four Queen titles, and Grand Tour become earnable, including retroactively | New badge criteria, original ids in git |
| T020 (complete) | A filly chases the Triple Tiara and a colt the Triple Crown, following the real horse's career | Rerolling goals that already have progress, new rewards |
| T021 (complete) | Three more scenarios, levels to 140, correct card eras | Scenario identity work (now M015), cap-ladder changes |
| T022 (complete) | One command publishes content; the app shows its build and offers Restart when an update is ready | Gameplay, infrastructure changes, destructive cache or save resets |
| T023 | The owner's top playability complaints are fixed | Rebalancing by feel, without evidence |

## Definition of done

- Every agreed rule in the design docs is either implemented or carries an explicit, dated decision that supersedes it.
- A signed-in install reaches the current code and the current published content, and says which versions it has.
- `pnpm lint`, `pnpm test`, `pnpm build` pass; the startup bundle stays within budget; no private content is in git.
- The design docs, [decisions.md](../decisions.md), and [data-backlog.md](../research/data-backlog.md) match what shipped,
  and each completed task spec is deleted (D104).
