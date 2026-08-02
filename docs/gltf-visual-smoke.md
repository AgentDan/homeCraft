# glTF visual smoke — BASE-600

Manual checklist after client changes to `ScenePreview` / module pose.

## Setup

1. `npm run dev` (server + client).
2. Place or restore a plan that includes `BASE-600` (e.g. «добавь базу 600»).
3. Orbit to a fixed view: room corner visible, module seen from +X / +Y / +Z side.

## Checks

- [ ] `BASE-600` shows **glTF** mesh (facade panel on +Z), not a uniform green/oak box — unless Network shows `/gltf/BASE-600.glb` failed.
- [ ] Overall **footprint and height** match former box (0.6 × 0.72 × 0.56 m); no float/sink vs floor.
- [ ] Module **center** aligns with previous box placement (corner of cabinet near wall corner when placed at origin).
- [ ] Switch finish white ↔ oak: **only facade** recolors; carcass stays grey-ish.
- [ ] SKU **without** `.glb` (e.g. `DRAWER-400` if not shipped): solid box fallback; dialog still works; console may warn on 404.
- [ ] Failed load: console `[ScenePreview] glTF load failed…`; UI stays on box; no blank canvas / crash.

## Pose invariant

Position formula unchanged: `position/1000 + size/2` (center-origin). See [model-authoring-spec.md](model-authoring-spec.md).
