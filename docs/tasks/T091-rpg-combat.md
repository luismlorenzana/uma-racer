# T091 — Deterministic RPG combat engine

**Goal:** a pure battle that can be replayed from a frozen encounter plus player commands, independent of React,
PixiJS and save state. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[Minigame kit](../design/minigame-kit.md) and D216–D219. Depends on T089.

## Scope and contract

- Implement typed actors, formation/targeting, initiative, HP/MP, basic Attack/Guard, skill costs, physical/magical
  defense, healing, buffs/debuffs, KO and win/loss. Item action is disabled until a consumable rule exists. Enemy
  intents, target order and phase changes are surfaced before commitment and derived from frozen content plus seed.
- Six weapon paths retain their channel: Front Greatsword and both Pace paths physical; both Late paths and End Tome
  magical. MP-costing physical-element skills stay physical. Implement five-element matrix with Fire/Ice/Lightning
  triangle and Light/Dark reciprocity, neutral cross-family interaction, resistance, bounded statuses and support.
- Provide the compositional skill definition shape (weapon motif × element × target/rhythm/support branch) and a
  minimal synthetic action set proving all six paths and all five elements; no copyrighted names, rows or assets.
  Player actions, engine decisions and result form a versioned, hashable replay; never call `Math.random`.
- Run a focused synthetic combat sim comparing neutral/advantaged/disadvantaged fights, physical rider behavior,
  healer/guard utility and no extra-action versus bounded follow-up. Settle coefficients, stacking/duration and any
  follow-up rule in the design, append a decision and pin numeric invariants in `domain.test.ts`.

## Acceptance

Fixed-seed replay hashes match across repeated runs and action prefixes; illegal skills/targets cannot mutate state;
all six paths are viable without violating their damage channel; enemy intent and phase transitions never reroll.
`pnpm lint`, `pnpm test`, `pnpm build` and RPG combat sim pass. Remove this spec in its PR (D104).

**Out of scope:** save transactions, UI, real PriConne rosters and EXP/items.
