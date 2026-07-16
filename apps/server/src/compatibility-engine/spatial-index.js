/**
 * Grid-based spatial index for neighbor lookup (not O(n²)).
 * Step0: stub API; implementation in phase 2.
 */
export class SpatialIndex {
  constructor(cellSizeMm = 200) {
    this.cellSizeMm = cellSizeMm;
  }

  /** @throws Error — not implemented in step0 */
  buildFromPlan(_plan) {
    throw new Error('Not implemented');
  }

  /** @throws Error — not implemented in step0 */
  getNeighbors(_instanceId) {
    throw new Error('Not implemented');
  }
}
