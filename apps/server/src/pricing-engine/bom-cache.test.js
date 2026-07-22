import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationPlanSchema } from '@homecraft/contracts';
import {
  buildBomCacheKey,
  getBomCacheStats,
  getCachedBOM,
  resetBomCacheForTests
} from './bom-cache.js';
import { listCatalogSnapshots } from '../knowledge-base/catalog-store.js';

const SNAPSHOT = 'kitchen-demo-v1';

function planWith(operations) {
  return ConfigurationPlanSchema.parse({
    planId: 'p-bom-cache',
    projectId: 'proj-bom',
    catalogSnapshotId: SNAPSHOT,
    operations,
    createdAt: new Date().toISOString()
  });
}

describe('Phase 3 BOM cache + catalog snapshots', () => {
  beforeEach(() => {
    resetBomCacheForTests();
  });

  it('lists the demo catalog snapshot', async () => {
    const snapshots = await listCatalogSnapshots();
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].id, SNAPSHOT);
    assert.equal(snapshots[0].currency, 'EUR');
    assert.ok(snapshots[0].moduleCount >= 15);
    assert.equal(snapshots[0].default, true);
  });

  it('builds a stable cache key from operations + snapshot', () => {
    const plan = planWith([
      {
        type: 'add_module',
        sku: 'BASE-600',
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0
      }
    ]);
    const keyA = buildBomCacheKey(plan, SNAPSHOT);
    const keyB = buildBomCacheKey(structuredClone(plan), SNAPSHOT);
    assert.equal(keyA, keyB);
    assert.match(keyA, /^bom:v1:kitchen-demo-v1:/);
  });

  it('reports a cache hit on the second identical BOM request', async () => {
    const plan = planWith([
      {
        type: 'add_module',
        sku: 'BASE-600',
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0
      }
    ]);

    const first = await getCachedBOM(plan, SNAPSHOT);
    const afterMiss = getBomCacheStats();
    assert.equal(afterMiss.misses, 1);
    assert.equal(afterMiss.hits, 0);
    assert.ok(first.totalEur > 0);

    const second = await getCachedBOM(plan, SNAPSHOT);
    const afterHit = getBomCacheStats();
    assert.equal(afterHit.misses, 1);
    assert.equal(afterHit.hits, 1);
    assert.equal(afterHit.hitRate, 0.5);
    assert.equal(second.totalEur, first.totalEur);
  });
});
