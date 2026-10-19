# T150 · Release-backed web and art; retire duplicate importers

Part of M035 / SE1. Replace the old GameTora-pack loader with a platform-release loader plus one game adapter.
Preserve game-facing queries and art fallbacks without retaining a second importer. Use per-outfit `outfit-faces`,
`outfit-busts`, `outfit-chibis`, and platform card/skill/scenario atlases. No CSS crop workaround. Keep authenticated
fetch, manifest/file hash validation, last-good offline boot, cancelled-load safety, and art lifecycle tests.

Remove unused old runtime/parser/transport paths and tests, `scripts/data`, `scripts/assets`, dead imageSource URLs,
their workspace tasks/dependencies, the now-expired old-route redirects and first-boot wipe. Move only surviving
racer overlays/tools, never retain unused originals to satisfy old tests. Keep saves/schema and T144 purge separate.
SE4 remains separately queued for any shared-provider consolidation not required by SE1; do not silently start it.

Tests use uma-data's synthetic release builder and invented image bytes. Cover outfit face identity, optional art,
unknown ids, corrupt cache repair/rejection, offline restart, release change, cancellation, and unchanged game routes.
