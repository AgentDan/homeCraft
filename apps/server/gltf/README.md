# Homecraft glTF assets (`kitchen-demo-v1`)

Static files served at `/gltf/{sku}.glb` and `/gltf/{sku}.png`.

## Rules

- Filename = exact catalog `sku`.
- **Do not overwrite** a published `.glb` / `.png` under the same snapshot. Geometry/material/preview change ⇒ new snapshot + new path policy.
- Author against [model-authoring-spec.md](../../../docs/model-authoring-spec.md).
- Validate before merge: `npm run validate:gltf`
- After adding/replacing a `.glb`: `npm run render:gltf-thumbs` (skips existing PNGs unless deleted)
- Demo authoring helper: `node apps/server/scripts/author-demo-glb.mjs --force`

## Thumbnails

Generated once with `apps/server/scripts/render-gltf-thumbnails.mjs` (three.js GLTFLoader + offscreen canvas).  
`buildCandidatesResponse` sets `option.thumbnailUrl` only when the PNG exists.

## Present SKUs (placeholders)

Homecraft-authored low-poly placeholders matching catalog bbox / center origin / `facade`+`carcass` slots. Replace with artist models only via a new snapshot path, not in-place overwrite.
