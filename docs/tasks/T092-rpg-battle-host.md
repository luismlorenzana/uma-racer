# T092 — Battle journal, offline pending and result commit

**Outcome:** a frozen battle survives reload and cross-device conflict without rerolling or orphaning a result.
Depends on T090/T091. Read [M028](M028-uma-rpg.md), [implementation contract](../technical/uma-rpg-implementation.md),
[Architecture](../technical/architecture.md), D219/D223 and the implemented T090/T091 interfaces.

## Host deliverables

1. Provide a typed web `RpgBattleHost` with enter, resume, submit action, explicit takeover, complete and abandon to
   checkpoint operations (names may fit surrounding code; semantics may not change). Enter uses T090's grouped
   checkpoint command and frozen entry; action appends only to a device-local Dexie journal **after** the pure
   reducer accepts it; complete checks terminal replay hash and sends one revision-checked grouped result. T096
   later adds EXP to that same command, not a separate write.
2. Version the journal engine input and action encoding, keyed by frozen entry id **plus retry ordinal**. On
   same-device reload replay every action and compare hash
   before enabling controls. Missing/corrupt local journal offers an explicit restart from the **same** frozen
   entry. Archive/prune only after an accepted receipt can reconstruct the result. Never apply a 64-action cap from
   ticketed `MinigameHost`.
3. Offline entry/result is Pending. Actions continue locally, but a pending result cannot advance map, grant EXP or
   unlock Items. On acknowledgement move to Accepted. On second-device takeover increment only lease/revision and
   restart the same entry; the former device becomes Stale and cannot commit. A rejected old result stays visible as
   conflicted history, not reissued as a new attempt.
4. Supply one host view model for Open, Pending, Conflict, Frozen content unavailable, Loss and Accepted. Memory-only
   development and local JSON API honor the same semantics; neither pretends a browser journal synced to another
   device.

## Recovery matrix and acceptance

Interrupt after each action; reload mid-animation; duplicate/illegal action; background/foreground; missing local
journal; offline finish/reconnect; two takeovers; old-device commit after takeover; duplicate accepted terminal
receipt; free loss retry at identical seed/content. An accepted loss and later winning retry have distinct result ids
but the same frozen entry/seed/kit. Assert exactly one accepted reward and zero orphan evidence.
`pnpm lint`, `pnpm test`, `pnpm build` and fixed replay tests pass. Update architecture and delete this spec in the
same PR (D104).

**Out of scope:** battle screen, map, EXP and token grants. T095 owns map navigation, T096 adds EXP, T098 adds
chapter token clear/spend.
