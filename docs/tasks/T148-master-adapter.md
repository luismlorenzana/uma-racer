# T148 · Pure racer adapter over uma-data

Part of M035 / SE1. Implement `@racer/domain/master`, consuming exact uma-data 1.1.0 master types. Preserve the
field-level contract in uma-platform `docs/racer-mapping.md`, including String ids, Global overrides, race/course
eligibility, objective order, SSR filtering/median effects, normal/inherited skill links, starter rules and racer terms.

Move pure flair/card-focus override validation out of the retired importer; one adapter applies the same private
overlay to device and server. Keep the scenario-coverage freshness guard, aggregate-only. Missing essential authored
overlay must be visible, not silently strip achievements. Missing/unknown referenced ids must not crash the app.

Synthetic tests cover two outfits of one character, unknown ids, Global-vs-JP skills, inherited/normal pairs,
geometry, grade/venue filters, median effects, malformed overlays, and no mutation of input records. A private local
comparison against the last racer release resolves every difference; only aggregate results enter git.
