import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationPlanSchema } from '@homecraft/contracts';
import { assertCompatible } from './compatibility-engine/assertCompatible.js';

const SNAPSHOT = 'kitchen-demo-v1';

/**
 * @param {Array<Record<string, unknown>>} operations
 */
function planWith(operations) {
  return ConfigurationPlanSchema.parse({
    planId: 'p-test',
    projectId: 'proj-1',
    catalogSnapshotId: SNAPSHOT,
    operations,
    createdAt: new Date().toISOString()
  });
}

/**
 * @param {{ utilities?: unknown[] }} [overrides]
 */
function roomContext(overrides = {}) {
  return {
    projectId: 'proj-1',
    sessionId: 'sess-1',
    catalogSnapshotId: SNAPSHOT,
    roomShape: {
      dimensions: { widthMm: 4000, depthMm: 4000, heightMm: 2700 },
      walls: [],
      openings: [],
      utilities: overrides.utilities ?? []
    },
    dialogTurns: [],
    updatedAt: new Date().toISOString()
  };
}

/** @param {string} sku @param {{ x: number, y: number, z: number }} position */
function add(sku, position) {
  return { type: 'add_module', sku, position, rotationY: 0 };
}

describe('@homecraft/server compatibility rules', () => {
  it('flags a sink placed far from its water and drain connections', async () => {
    const plan = planWith([add('SINK-600', { x: 0, y: 0, z: 0 })]);
    const context = roomContext({
      utilities: [
        { id: 'w1', kind: 'water', position: { x: 3800, y: 0, z: 3800 } },
        { id: 'd1', kind: 'drain', position: { x: 3800, y: 0, z: 3800 } }
      ]
    });

    const report = await assertCompatible(plan, context);
    assert.equal(report.valid, false);
    assert.ok(report.conflicts.some((conflict) => conflict.kind === 'utility_conflict'));
  });

  it('accepts a sink placed next to its connections', async () => {
    const plan = planWith([add('SINK-600', { x: 0, y: 0, z: 0 })]);
    const context = roomContext({
      utilities: [
        { id: 'w1', kind: 'water', position: { x: 300, y: 0, z: 280 } },
        { id: 'd1', kind: 'drain', position: { x: 300, y: 0, z: 280 } }
      ]
    });

    const report = await assertCompatible(plan, context);
    assert.equal(report.valid, true);
  });

  it('skips utility checks when the room models no utility points', async () => {
    const plan = planWith([add('SINK-600', { x: 0, y: 0, z: 0 })]);
    const report = await assertCompatible(plan, roomContext());
    assert.equal(report.valid, true);
  });

  it('flags appliances that violate a significant side clearance', async () => {
    const plan = planWith([
      add('HOB-600', { x: 0, y: 0, z: 0 }),
      add('OVEN-600', { x: 600, y: 0, z: 0 })
    ]);
    const report = await assertCompatible(plan, roomContext());
    assert.equal(report.valid, false);
    assert.ok(report.conflicts.some((conflict) => conflict.kind === 'clearance_violation'));
  });

  it('allows base cabinets to sit flush (filler clearance is not enforced)', async () => {
    const plan = planWith([
      add('BASE-600', { x: 0, y: 0, z: 0 }),
      add('BASE-400', { x: 600, y: 0, z: 0 })
    ]);
    const report = await assertCompatible(plan, roomContext());
    assert.equal(report.valid, true);
  });

  it('suggests a narrower analog for an overlapping cabinet', async () => {
    const plan = planWith([
      add('BASE-600', { x: 0, y: 0, z: 0 }),
      add('BASE-400', { x: 100, y: 0, z: 0 })
    ]);
    const report = await assertCompatible(plan, roomContext());
    assert.equal(report.valid, false);
    const overlap = report.conflicts.find((conflict) => conflict.kind === 'overlap');
    assert.ok(overlap);
    assert.ok(overlap.suggestedSkus.includes('BASE-400'));
  });

  it('clears overlap after replacing the conflicting module with a suggested analog', async () => {
    const conflicting = planWith([
      add('BASE-800', { x: 0, y: 0, z: 0 }),
      add('BASE-400', { x: 700, y: 0, z: 0 })
    ]);
    const before = await assertCompatible(conflicting, roomContext());
    assert.equal(before.valid, false);
    assert.ok(before.conflicts.some((conflict) => conflict.kind === 'overlap'));

    const resolved = planWith([
      add('BASE-800', { x: 0, y: 0, z: 0 }),
      add('BASE-400', { x: 700, y: 0, z: 0 }),
      { type: 'replace_module', instanceId: 'module-1', sku: 'BASE-600' }
    ]);
    const after = await assertCompatible(resolved, roomContext());
    assert.equal(after.valid, true);

    const { materializePlan } = await import('./domain-modules/kitchen/materialize-plan.js');
    const modules = await materializePlan(resolved);
    const swapped = modules.find((module) => module.instanceId === 'module-1');
    assert.equal(swapped?.sku, 'BASE-600');
    assert.deepEqual(swapped?.position, { x: 0, y: 0, z: 0 });
  });
});
