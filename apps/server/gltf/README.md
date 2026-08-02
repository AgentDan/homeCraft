# Homecraft glTF assets (`kitchen-demo-v1`)

Static files served at `/gltf/{sku}.glb` (and later `/gltf/{sku}.png`).

## Rules

- Filename = exact catalog `sku`.
- **Do not overwrite** a published file under the same snapshot. Geometry/material change ⇒ new snapshot + new path policy.
- Author against [model-authoring-spec.md](../../../docs/model-authoring-spec.md).
- Validate before merge: `npm run validate:gltf --workspace @homecraft/server`

## Thumbnails

`{sku}.png` next to `.glb` — generated once in phase 5 (offscreen). Missing PNG is OK; options UI stays text-only until then.

## Present SKUs (placeholders)

Homecraft-authored low-poly placeholders matching catalog bbox / center origin / `facade`+`carcass` slots. Replace with artist models only via a new snapshot path, not in-place overwrite.
