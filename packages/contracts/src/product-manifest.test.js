import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  ProductManifestSchema,
  ProductTypeSchema,
  createEmptyPlan,
  registry
} from './index.js';

describe('ProductManifest contracts', () => {
  it('defaults legacy plans to kitchen', () => {
    const plan = createEmptyPlan({
      planId: 'plan-1',
      projectId: 'project-1',
      catalogSnapshotId: 'catalog-1'
    });

    assert.equal(plan.productType, 'kitchen');
    assert.equal(ProductTypeSchema.parse('desk'), 'desk');
    assert.throws(() => ProductTypeSchema.parse('unknown'));
  });

  it('parses a domain manifest', () => {
    const manifest = ProductManifestSchema.parse({
      productType: 'test-domain',
      version: '1.0.0',
      slotsSchema: z.object({ layout: z.string() }),
      assertCompatible: (_plan) => ({ valid: true }),
      calculateBOM: (_plan) => ({ lines: [] }),
      journeyQuestions: [],
      dp4Rules: [],
      starterPlan: () => ({ productType: 'test-domain' })
    });

    assert.equal(manifest.productType, 'test-domain');
  });

  it('rejects duplicate registrations and unknown lookups', () => {
    const manifest = ProductManifestSchema.parse({
      productType: 'registry-test-domain',
      version: '1.0.0',
      slotsSchema: z.object({}),
      assertCompatible: (_plan) => ({ valid: true }),
      calculateBOM: (_plan) => ({ lines: [] }),
      journeyQuestions: [],
      dp4Rules: [],
      starterPlan: () => ({})
    });

    registry.register(manifest);

    assert.equal(registry.get('registry-test-domain'), manifest);
    assert.ok(registry.registeredTypes().includes('registry-test-domain'));
    assert.throws(
      () => registry.register(manifest),
      /Manifest already registered: registry-test-domain/
    );
    assert.throws(
      () => registry.get('unknown'),
      /No manifest registered for productType: unknown/
    );
  });
});
