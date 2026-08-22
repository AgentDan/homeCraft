/** Shared geometry helpers for compatibility rules. */

/**
 * Footprint of a module in the XZ plane, accounting for 90° rotation.
 * @param {{ dimensions: { widthMm: number, depthMm: number }, rotationY: number }} module
 */
export function footprint(module) {
  const rotated = Math.abs(module.rotationY % 180) === 90;
  return {
    widthMm: rotated ? module.dimensions.depthMm : module.dimensions.widthMm,
    depthMm: rotated ? module.dimensions.widthMm : module.dimensions.depthMm
  };
}

/**
 * Axis-aligned bounding box of a module in room coordinates (mm).
 * @param {{
 *   position: { x: number, y: number, z: number },
 *   dimensions: { widthMm: number, heightMm: number, depthMm: number },
 *   rotationY: number
 * }} module
 */
export function boundingBox(module) {
  const size = footprint(module);
  return {
    minX: module.position.x,
    maxX: module.position.x + size.widthMm,
    minY: module.position.y,
    maxY: module.position.y + module.dimensions.heightMm,
    minZ: module.position.z,
    maxZ: module.position.z + size.depthMm
  };
}

/**
 * @param {ReturnType<typeof boundingBox>} a
 * @param {ReturnType<typeof boundingBox>} b
 */
export function boxesOverlap(a, b) {
  return (
    a.minX < b.maxX && a.maxX > b.minX
    && a.minY < b.maxY && a.maxY > b.minY
    && a.minZ < b.maxZ && a.maxZ > b.minZ
  );
}

/**
 * Center of a module footprint in the XZ plane (mm).
 * @param {{ position: { x: number, z: number } } & Parameters<typeof footprint>[0]} module
 */
export function centerXZ(module) {
  const size = footprint(module);
  return {
    x: module.position.x + size.widthMm / 2,
    z: module.position.z + size.depthMm / 2
  };
}
