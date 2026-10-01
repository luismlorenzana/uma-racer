# T094 — Mobile RPG battle screen

**Goal:** a legible, touch-first five-member battle against synthetic encounters whose animation follows the engine.
Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md), [Minigame kit](../design/minigame-kit.md)
and the T091/T092 interfaces. Depends on T091–T093.

## Scope and contract

- Render five Uma combatants with weapon/element overlays, enemy formation, selected target, HP/MP, statuses, visible
  intent, weakness/resistance and projected action effect. Thumb-zone Attack/Skill/Guard controls, target selection,
  MP/slot legality and end-turn flow call the host; the screen does not roll or calculate damage.
- Show distinct physical/magical, elemental-rider, heal, guard and phase feedback. The result view names KO/outcome,
  decisive actions and the typed reward summary provided by later tasks; it must not claim EXP or items before they
  exist. Same-device reload resumes the exact turn; second-device takeover and unavailable content have explicit
  screens, never a friendly reroll.
- Use the existing React/Motion conventions (`m.*`, transform/opacity and delta timing); PixiJS is optional only if
  it helps the five-actor stage and remains lazy. Respect reduced motion, VoiceOver labels, ≥44 pt targets, `pb-safe`
  and no document scroll during a fight. Keep real enemy art out of git.

## Acceptance

Scripted synthetic tests and browser flow cover a heal, guard, weakness, KO, boss phase, resume and loss/retry. Attach
390×844 and 375×667 mid-battle/result screenshots and check touch target/overlay legibility. `pnpm lint`,
`pnpm test`, `pnpm build` and replay tests pass; report startup gzip ≤180 KB and battle chunk. Remove this spec in
its PR (D104).

**Out of scope:** Home entry, map, private enemies, progression rewards and Inspiration tokens.
