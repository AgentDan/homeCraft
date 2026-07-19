/** Grid-based spatial index for broad-phase overlap checks. */
export class SpatialIndex {
  constructor(cellSizeMm = 1000) {
    this.cellSizeMm = cellSizeMm;
    this.cells = new Map();
    this.moduleCells = new Map();
  }

  cellKey(x, z) {
    return `${x}:${z}`;
  }

  buildFromModules(modules) {
    this.cells.clear();
    this.moduleCells.clear();
    for (const module of modules) {
      const width = Math.abs(module.rotationY % 180) === 90
        ? module.dimensions.depthMm
        : module.dimensions.widthMm;
      const depth = Math.abs(module.rotationY % 180) === 90
        ? module.dimensions.widthMm
        : module.dimensions.depthMm;
      const minX = Math.floor(module.position.x / this.cellSizeMm);
      const maxX = Math.floor((module.position.x + width) / this.cellSizeMm);
      const minZ = Math.floor(module.position.z / this.cellSizeMm);
      const maxZ = Math.floor((module.position.z + depth) / this.cellSizeMm);
      const keys = [];
      for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          const key = this.cellKey(x, z);
          keys.push(key);
          const entries = this.cells.get(key) ?? new Set();
          entries.add(module.instanceId);
          this.cells.set(key, entries);
        }
      }
      this.moduleCells.set(module.instanceId, keys);
    }
    return this;
  }

  getNeighbors(instanceId) {
    const neighbors = new Set();
    for (const key of this.moduleCells.get(instanceId) ?? []) {
      for (const candidateId of this.cells.get(key) ?? []) {
        if (candidateId !== instanceId) {
          neighbors.add(candidateId);
        }
      }
    }
    return [...neighbors];
  }
}
