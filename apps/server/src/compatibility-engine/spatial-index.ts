import type { ConfigurationPlan } from '@homecraft/contracts';

export type SpatialCell = {
  x: number;
  y: number;
  instanceIds: string[];
};

/**
 * Grid-based spatial index for neighbor lookup (not O(n²)).
 * Step0: stub API; implementation in phase 2.
 */
export class SpatialIndex {
  constructor(private readonly cellSizeMm = 200) {
    void this.cellSizeMm;
  }

  /** @throws Error — not implemented in step0 */
  buildFromPlan(_plan: ConfigurationPlan): void {
    throw new Error('Not implemented');
  }

  /** @throws Error — not implemented in step0 */
  getNeighbors(_instanceId: string): string[] {
    throw new Error('Not implemented');
  }
}
