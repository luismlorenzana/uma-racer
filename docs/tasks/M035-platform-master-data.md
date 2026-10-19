# M035 · SE1: one master-data and art source

Source: sibling packet SE1, rearchitecture/02 §2 and uma-platform's `docs/racer-mapping.md`. One integration PR and
deploy; no save reset, rule retuning, unrelated work-system adoption, or shared-component forks. The owner explicitly
assigned SE1 to this session on 2026-10-18, including its cleanup. P60: local browser checks, never Simulator.

## Sequence and release gates

1. T148: pure master adapter and synthetic parity tests.
2. T149: private racer overlays and authenticated master source; shared server proxy where already available.
3. T150: web release/art switch, per-outfit faces, offline verified cache, retire superseded client/import pipelines.
4. T151: local private parity, full checks/browser acceptance, protected PR merge and standard deployment; verify the
   deployed master source before deleting any retired cloud object. Then retire these specs and close both queues.

No historical save or private authored overlay is cleanup material. Keep T144's purge endpoint/call until its own
owner-confirmation task; remove only the first-boot wipe and redirects whose documented lifetime ends at SE1.

## Acceptance

- Every master read uses schema-major-1 platform releases, following latest. Device/server use one pure adapter.
- String ids, racer catalogue filtering, card effects/focus, skill mechanics and flair semantics remain unchanged.
- Original data/art and private parity details remain gitignored; CI fixtures are invented.
- Stable faces use the same `outfit-faces` family as RPG. Busts, plaza chibis, card/icon art and Farm art still work.
- Cached, previously loaded content supports a cold offline restart; corruption never becomes accepted content.
- lint, test, test:ci, build, generated docs; startup ≤180 KB gzip. Local 390×844 light/dark checks.
- Production exact-SHA deployment green; master routes authenticated, latest readable, hash-verified source/art;
  safe cleanup inventories exact retired objects and preserves overlays. No broad bucket deletion.
