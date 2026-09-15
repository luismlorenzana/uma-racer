# Data pipeline (not built yet)

Turns GameTora's public datasets into **private content packs** in the gitignored `content/` folder, which get uploaded to
the private bucket for production (docs/technical/architecture.md#3-content-reference-data-and-images).

## Reuse from uma-planner

`../uma-planner/scripts` already imports the same source reliably. Port the fetch and normalization logic, but write JSON
packs instead of Firestore docs:

| uma-planner script | Gives us | Uma Racer pack |
|---|---|---|
| `import-support-cards.cjs` | card id, character, type, rarity, `obtained`, JP/Global release, hint and event skill ids | `cards.json` (SSR only; `obtained` → starter set) |
| `import-support-card-details.cjs` | effect tables, unique effects | `cards.json` effect profiles |
| `import-skills.cjs` | full skill catalog, conditions, **`gene_version`** (the weaker inherited unique) | `skills.json` |
| `import-character-skills.cjs` + roster data | per-outfit skills | `umas.json` |
| domain `Character` type | `stats5` (5★ base stats), `statBonus` (growth rates), `aptitude`, release dates, images | `umas.json` |
| `import-character-details.cjs` | real-horse record and pedigree | `signatureRaces`, identity goals |

Source: `https://gametora.com/data/manifests/umamusume.json` → versioned dataset files under
`https://gametora.com/data/umamusume/`.

## Output shape

```text
content/
  manifest.json          { version, files: [{ path, bytes, sha256 }] }
  data/umas.<hash>.json
  data/cards.<hash>.json
  data/skills.<hash>.json
  data/races.<hash>.json
  atlases/…              (from scripts/assets)
```

Files are content-hashed, so the service worker can cache them forever.
