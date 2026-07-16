import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyPlan } from '@homecraft/contracts';
import { assertCompatible } from './compatibility-engine/assertCompatible.js';

describe('@homecraft/server smoke', () => {
  it('compatibility returns valid in step0', async () => {
    const plan = createEmptyPlan({
      planId: 'p1',
      projectId: 'proj-1',
      catalogSnapshotId: 'snap-1',
      sourceInputMode: 'dialog'
    });
    const report = await assertCompatible(plan, {
      projectId: 'proj-1',
      sessionId: 'sess-1',
      catalogSnapshotId: 'snap-1',
      roomShape: {
        dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
        walls: [],
        openings: [],
        utilities: []
      },
      dialogTurns: [],
      updatedAt: new Date().toISOString()
    });
    assert.equal(report.valid, true);
  });
});
