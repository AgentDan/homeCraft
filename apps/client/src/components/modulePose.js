/**
 * Center-origin pose shared by box fallback and glTF (do not change for corner-origin).
 * @param {{
 *   position: { x: number, y: number, z: number },
 *   dimensions: { widthMm: number, heightMm: number, depthMm: number }
 * }} module
 * @returns {[number, number, number]}
 */
export function moduleCenterPosition(module) {
  const width = module.dimensions.widthMm / 1000;
  const height = module.dimensions.heightMm / 1000;
  const depth = module.dimensions.depthMm / 1000;
  return [
    module.position.x / 1000 + width / 2,
    module.position.y / 1000 + height / 2,
    module.position.z / 1000 + depth / 2
  ];
}
