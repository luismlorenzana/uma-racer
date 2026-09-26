# Milestone 9 — Look and feel

**Outcome:** the game stops looking like a 1990s children's web game and starts looking like the game it is: art-forward
and warm like *Umamusume*, restrained and precise like a modern HoYoverse menu.

The contract is [Visual System — "Paddock"](../design/visual-system.md). The diagnosis and the sources are in
[Game UI Reference](../research/game-ui-reference.md). Nothing in this milestone changes a rule, a number, a reward or a
simulation outcome (D111).

## Why now

Milestones 1–8 build the game; this one makes it worth opening. The owner's verdict on the current skin was blunt, and
the causes are specific: emoji as icons, a saturated sky gradient, one flat white panel style, a rounded display face
used for everything, slab buttons, candy colours, uniform density, and character art shown at thumbnail size.

## Sequence

```text
T030 visual system foundation      (Claude authors: tokens, primitives, two reference screens)
        │
        ├──► T031 screen rollout            (delegable, mechanical once T030 lands)
        │
        └──► T032 original icon set         (delegable, can run in parallel with T031)
```

| Task | Result | Must not absorb |
|---|---|---|
| T030 ✅ | Tokens, fonts, primitives, shell, Home and Stable — the reference the rollout copies | Screen-by-screen rollout, icons, audio |
| T031 ✅ | Every remaining screen uses the new system; no legacy token or slab button survives | New features, layout redesigns not in the visual system, gameplay changes |
| [T032](T032-icon-set.md) | One original icon set replaces every emoji, with illustrated tab and currency icons | Bespoke badge art (Milestone 11), character art |

T030 was authored by Claude because it is taste-driven and needs visual iteration in the browser at 390×844; it landed
on 2026-09-19 and also covered the shell. T031 landed on 2026-09-26 and was removed under D104: most screens had moved to
the system as they were built, and the last of the old skin went from Badges, the Trainer profile, race results, toasts,
flair cards and the loaders; the `GameButton` shim and the Racecourse Pop aliases are deleted, a test keeps them out,
and jsdom tests cover the primitives. Spark Match and Bond Recall keep a few colours until their rebuilds (the Spark
Match rework, M020).

## Definition of done

- No emoji, no `Racecourse Pop` token, and no slab button remain in `apps/web`.
- Every screen renders correctly at 390×844, in Comfortable and Compact density, with reduced motion, and with missing
  content placeholders.
- Contrast is at least 4.5:1 for text, targets are at least 44 pt, and no state is carried by colour alone.
- Startup JS stays at or below 180 KB gzip **including the two latin-subset font families**; evidence goes in the PR.
- `pnpm lint`, `pnpm test`, `pnpm build` pass, and the visual system doc matches what shipped.
