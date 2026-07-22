import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from './configuration-plan-generator.js';

describe('configuration-plan-generator replace_module', () => {
  it('appends replace_module for a conflict-resolution swap', async () => {
    const { plan, outcome } = await generatePlan({
      intent: {
        kind: 'replace_module',
        confidence: 0.75,
        language: 'en',
        rawText: 'replace module-1 with BASE-400',
        slots: { instanceId: 'module-1', sku: 'BASE-400' }
      },
      context: {
        projectId: 'proj-1',
        catalogSnapshotId: 'kitchen-demo-v1',
        planOperations: [
          {
            type: 'add_module',
            sku: 'BASE-600',
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0
          },
          {
            type: 'add_module',
            sku: 'BASE-800',
            position: { x: 600, y: 0, z: 0 },
            rotationY: 0
          }
        ]
      },
      candidates: [],
      dialogText: 'replace module-1 with BASE-400'
    });

    assert.equal(outcome.kind, 'applied');
    assert.equal(outcome.instanceId, 'module-1');
    assert.equal(outcome.sku, 'BASE-400');
    assert.deepEqual(plan.operations.at(-1), {
      type: 'replace_module',
      instanceId: 'module-1',
      sku: 'BASE-400'
    });
  });
});
