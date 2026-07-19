# HomeCraft platform rules

## Catalog grounding

- Every furniture operation must reference an SKU from the active catalog snapshot.
- Never invent SKU, dimensions, finishes, utilities, or prices.
- If the catalog does not contain a suitable module, ask the user to clarify.

## Geometry and compatibility

- AI translates user intent into a plan but never approves geometry.
- Compatibility Engine is the only plan rejector.
- A module must stay inside room dimensions and must not overlap another module.
- Wall modules require an elevated mounting position; floor and tall modules start at floor level.

## Pricing

- BOM reads prices only from the frozen `catalogSnapshotId`.
- Pricing reports budget overruns but never rejects a plan.

## Dialog

- Unknown commands require an explicit clarification; there is no silent default intent.
- Text and transcribed voice use the same `command` pipeline.
