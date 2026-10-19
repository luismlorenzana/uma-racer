# T149 · Master API and private racer overlays

Part of M035 / SE1. `/api/master/` proxies the platform release behind the existing guard, via the published shared
server module if available. Local source is the sibling platform's `content/release`; production source is the
private `uma-platform-master-data` bucket. Grant only the racer runtime service account objectViewer on that bucket;
scope gcloud config/project per runbook, never switch the active account or expose credentials.

Operations load the same verified master sets and private overlay as the web, cached per version with retry after
failure. Missing/corrupt content remains 503 and writes no save rows. Keep a minimal allowlisted private overlay
publisher in `scripts/overlays`, with immutable files before the index; preserve flair and card-focus authoring inputs.
No original master dataset/image is republished in the racer bucket. Tests cover auth, traversal/unallowlisted paths,
version refresh, corruption, failed-load retry, and device/server adapter equality.
