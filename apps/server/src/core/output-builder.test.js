import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildChangeSummary } from './output-builder.js';

describe('buildChangeSummary', () => {
  const plan = {
    operations: [
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
      },
      {
        type: 'replace_module',
        instanceId: 'module-2',
        sku: 'BASE-400'
      },
      {
        type: 'remove_module',
        instanceId: 'module-1'
      },
      {
        type: 'move_module',
        instanceId: 'module-2',
        position: { x: 100, y: 0, z: 0 }
      }
    ]
  };

  it('fallback path summarizes the full plan without replace_module dual listing', () => {
    const summary = buildChangeSummary(plan, 'done');
    assert.deepEqual(summary, {
      text: 'done',
      added: ['BASE-600', 'BASE-800'],
      removed: ['module-1'],
      moved: ['module-2']
    });
  });

  it('dialog delta path includes only new ops and lists replace in added and removed', () => {
    const summary = buildChangeSummary(plan, 'replaced', {
      sinceOperationCount: 2
    });
    assert.deepEqual(summary, {
      text: 'replaced',
      added: ['BASE-400'],
      removed: ['module-2', 'module-1'],
      moved: ['module-2']
    });
  });
});
