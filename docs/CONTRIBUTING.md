# Contributing to HomeCraft

## Architecture invariants (non-negotiable)

1. **Dialog is the only input path:** every command becomes one `ConfigurationPlan` in `orchestrator.route()` and then uses the shared downstream pipeline.
2. **`assertCompatible()`** is the **only** stage that may reject a plan (`valid: false`).
3. **`calculateBOM()`** is a pure calculator — never blocks on budget.
4. **Intent detection** is English-only; no silent fallback — use `UnknownIntent`.
5. **`catalog-rag-retriever`** must be wired into `configuration-plan-generator` (no dead AI paths).
6. **Catalog snapshots** — BOM reads frozen `catalogSnapshotId`, not live catalog.
7. **Spatial index** for compatibility (no O(n²) in production hot path).
8. **Zod** at every network/storage boundary (plain JavaScript ESM, no TypeScript build step).
9. **`structuredClone`** for cloning — `JSON.parse(JSON.stringify(...))` is banned (ESLint).
10. **UI typography:** font-weight 400 and 500 only; sentence case.

## ESLint

Root `eslint.config.js` includes `no-restricted-syntax` for JSON clone anti-pattern.

```bash
npm run lint
```

## Code review checklist

- [ ] Invariants 1–10 respected
- [ ] New API fields have Zod schemas in `@homecraft/contracts`
- [ ] `npm run typecheck` and `npm run test` pass
- [ ] No business logic in compatibility/pricing that belongs elsewhere

## Storage

- **MongoDB** — structured project/catalog data
- **Local FS** — `apps/server/data/` (or `SERVER_STORAGE_DIR`), same pattern as AIproject

## Phase workflow

Follow [docs/Roadmap.md](docs/Roadmap.md). Each phase = focused PR with acceptance criteria from the roadmap.
