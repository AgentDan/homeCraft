import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationPlanSchema } from '@homecraft/contracts';
import { assertCompatible } from './assertCompatible.js';
import { generateCandidates } from './candidate-generator.js';

const SNAPSHOT = 'kitchen-demo-v1';

function planWith(operations) {
  return ConfigurationPlanSchema.parse({
    planId: 'p-cand',
    projectId: 'proj-1',
    catalogSnapshotId: SNAPSHOT,
    operations,
    createdAt: new Date().toISOString()
  });
}

function add(sku, position) {
  return { type: 'add_module', sku, position, rotationY: 0 };
}

function roomContext() {
  return {
    projectId: 'proj-1',
    sessionId: 'sess-1',
    catalogSnapshotId: SNAPSHOT,
    roomShape: {
      dimensions: { widthMm: 4000, depthMm: 4000, heightMm: 2700 },
      walls: [],
      openings: [],
      utilities: []
    },
    dialogTurns: [],
    updatedAt: new Date().toISOString()
  };
}

describe('candidate-generator', () => {
  it('produces valid priced candidates for an overlap conflict', async () => {
    const plan = planWith([
      add('BASE-800', { x: 0, y: 0, z: 0 }),
      add('BASE-400', { x: 700, y: 0, z: 0 })
    ]);
    const context = roomContext();
    const compatibility = await assertCompatible(plan, context);
    assert.equal(compatibility.valid, false, 'plan should be rejected');

    const candidates = await generateCandidates({
      plan,
      compatibility,
      context
    });

    assert.ok(candidates.length >= 1, 'at least 1 candidate expected');
    assert.ok(candidates.length <= 3, 'at most 3 candidates');

    for (const candidate of candidates) {
      assert.ok(candidate.label, 'each candidate has a label');
      assert.ok(candidate.plan, 'each candidate has a plan');
      assert.ok(typeof candidate.bom.totalEur === 'number', 'BOM total is a number');
      assert.ok(candidate.replacedWithSku, 'has replacedWithSku');

      const recheck = await assertCompatible(candidate.plan, context);
      assert.equal(recheck.valid, true, `candidate "${candidate.label}" must be valid`);
    }
  });

  it('returns empty array when no analog resolves the conflict', async () => {
    const compatibility = {
      valid: false,
      conflicts: [
        {
          kind: 'unsupported_appliance',
          message: 'Unknown appliance',
          instanceIds: [],
          suggestedSkus: []
        }
      ],
      checkedAt: new Date().toISOString()
    };
    const plan = planWith([add('BASE-600', { x: 0, y: 0, z: 0 })]);
    const candidates = await generateCandidates({
      plan,
      compatibility,
      context: roomContext()
    });
    assert.equal(candidates.length, 0);
  });
});
