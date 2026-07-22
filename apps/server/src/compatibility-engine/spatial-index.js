/**
 * Grid-based spatial index for broad-phase overlap checks.
 * @param {Array<{
 *   instanceId: string,
 *   position: { x: number, z: number },
 *   rotationY: number,
 *   dimensions: { widthMm: number, depthMm: number }
 * }>} modules
 * @param {number} [cellSizeMm=1000]
 */
export function buildSpatialIndex(modules, cellSizeMm = 1000) {
  const cells = new Map();
  const moduleCells = new Map();

  for (const module of modules) {
    const width = Math.abs(module.rotationY % 180) === 90
      ? module.dimensions.depthMm
      : module.dimensions.widthMm;
    const depth = Math.abs(module.rotationY % 180) === 90
      ? module.dimensions.widthMm
      : module.dimensions.depthMm;
    const minX = Math.floor(module.position.x / cellSizeMm);
    const maxX = Math.floor((module.position.x + width) / cellSizeMm);
    const minZ = Math.floor(module.position.z / cellSizeMm);
    const maxZ = Math.floor((module.position.z + depth) / cellSizeMm);
    const keys = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const key = `${x}:${z}`;
        keys.push(key);
        const entries = cells.get(key) ?? new Set();
        entries.add(module.instanceId);
        cells.set(key, entries);
      }
    }
    moduleCells.set(module.instanceId, keys);
  }

  return {
    /**
     * @param {string} instanceId
     * @returns {string[]}
     */
    getNeighbors(instanceId) {
      const neighbors = new Set();
      for (const key of moduleCells.get(instanceId) ?? []) {
        for (const candidateId of cells.get(key) ?? []) {
          if (candidateId !== instanceId) {
            neighbors.add(candidateId);
          }
        }
      }
      return [...neighbors];
    }
  };
}
