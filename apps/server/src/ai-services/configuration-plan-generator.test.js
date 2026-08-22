import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import { kitchenStarterOperations } from '@homecraft/manifests/kitchen/starter-operations';
import { generatePlan } from './configuration-plan-generator.js';

/**
 * @param {Record<string, unknown>} overrides
 */
function planInput(overrides = {}) {
  const context = /** @type {Record<string, unknown>} */ (overrides.context ?? {});
  const intent = /** @type {Record<string, unknown>} */ (overrides.intent ?? {});
  return {
    intent: {
      kind: 'add_module',
      confidence: 0.9,
      language: 'en',
      rawText: 'add module',
      slots: {},
      ...intent
    },
    context: {
      projectId: 'proj-1',
      catalogSnapshotId: 'kitchen-demo-v1',
      planOperations: [],
      ...context
    },
    candidates: overrides.candidates ?? [],
    dialogText: overrides.dialogText ?? 'add module'
  };
}

describe('configuration-plan-generator domain data', () => {
  before(() => {
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(deskManifest);
    }
  });

  it('applies kitchen starterOperations when slots.layout is starter_kitchen', async () => {
    const { plan, outcome } = await generatePlan(planInput({
      intent: {
        kind: 'add_module',
        rawText: 'kitchen',
        slots: { layout: 'starter_kitchen' }
      },
      context: { productType: 'kitchen' }
    }));

    assert.equal(outcome.kind, 'applied');
    assert.equal(outcome.addedCount, 4);
    assert.deepEqual(plan.operations, kitchenStarterOperations);
  });

  it('places a wall-mounted kitchen candidate at wallMountHeightMm', async () => {
    const { plan, outcome } = await generatePlan(planInput({
      intent: {
        kind: 'add_module',
        rawText: 'add wall 600',
        slots: { sku: 'WALL-600' }
      },
      context: { productType: 'kitchen' },
      candidates: [{
        sku: 'WALL-600',
        category: 'wall_cabinet',
        mounting: 'wall',
        dimensions: { widthMm: 600, heightMm: 720, depthMm: 320 }
      }]
    }));

    assert.equal(outcome.kind, 'applied');
    assert.equal(outcome.sku, 'WALL-600');
    assert.deepEqual(plan.operations.at(-1), {
      type: 'add_module',
      sku: 'WALL-600',
      position: { x: 0, y: 1400, z: 0 },
      rotationY: 0
    });
  });

  it('skips the starter shortcut when the desk manifest has no starterOperations', async () => {
    const deskCandidate = {
      sku: 'DESK-1200',
      category: 'desk',
      mounting: 'floor',
      dimensions: { widthMm: 1200, heightMm: 750, depthMm: 600 }
    };

    const { plan, outcome } = await generatePlan(planInput({
      intent: {
        kind: 'add_module',
        rawText: 'kitchen',
        slots: { layout: 'starter_kitchen' }
      },
      context: {
        productType: 'desk',
        catalogSnapshotId: 'desk-demo-v1'
      },
      candidates: [deskCandidate]
    }));

    assert.equal(outcome.kind, 'applied');
    assert.equal(outcome.addedCount, 1);
    assert.equal(outcome.sku, 'DESK-1200');
    assert.equal(plan.operations.length, 1);
    assert.equal(plan.operations[0].type, 'add_module');
    assert.equal(plan.operations[0].sku, 'DESK-1200');
    assert.deepEqual(plan.operations[0].position, { x: 0, y: 0, z: 0 });
  });

  it('writes context.productType desk onto the generated plan', async () => {
    const deskCandidate = {
      sku: 'DESK-1200',
      category: 'desk',
      mounting: 'floor',
      dimensions: { widthMm: 1200, heightMm: 750, depthMm: 600 }
    };

    const { plan, outcome } = await generatePlan(planInput({
      intent: {
        kind: 'add_module',
        rawText: 'add a desk',
        slots: { sku: 'DESK-1200' }
      },
      context: {
        productType: 'desk',
        catalogSnapshotId: 'desk-demo-v1'
      },
      candidates: [deskCandidate]
    }));

    assert.equal(outcome.kind, 'applied');
    assert.equal(plan.productType, 'desk');
  });
});
