import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  ProductManifestSchema,
  ProductTypeSchema,
  createEmptyPlan,
  registry
} from './index.js';

/**
 * @param {string} productType
 */
function stubManifest(productType) {
  return ProductManifestSchema.parse({
    productType,
    version: '1.0.0',
    slotsSchema: z.object({}),
    assertCompatible: (_plan) => ({ valid: true }),
    calculateBOM: (_plan) => ({ lines: [] }),
    journeyQuestions: [],
    dp4Rules: [],
    starterPlan: () => ({})
  });
}

describe('ProductManifest contracts', () => {
  before(() => {
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(stubManifest('kitchen'));
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(stubManifest('desk'));
    }
  });

  it('defaults legacy plans to kitchen', () => {
    const plan = createEmptyPlan({
      planId: 'plan-1',
      projectId: 'project-1',
      catalogSnapshotId: 'catalog-1'
    });

    assert.equal(plan.productType, 'kitchen');
  });

  it('ProductTypeSchema accepts registered types and rejects unknown domains', () => {
    assert.equal(ProductTypeSchema.parse('kitchen'), 'kitchen');
    assert.equal(ProductTypeSchema.parse('desk'), 'desk');
    assert.throws(
      () => ProductTypeSchema.parse('made-up-domain'),
      /Unknown productType: not registered in ManifestRegistry/
    );
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

  it('initDomain invokes journey and DP4 callbacks from the manifest', () => {
    const questions = [
      {
        id: 'clientName',
        slot: 'clientName',
        stage: 'intro',
        order: 10,
        i18nKey: 'journeyAskClientName',
        validation: { type: 'text', minLength: 1, maxLength: 80 },
        dependsOn: null,
        active: true
      }
    ];
    const rules = [{ ruleId: 'r1' }];
    const manifest = ProductManifestSchema.parse({
      productType: 'init-domain-test',
      version: '1.0.0',
      slotsSchema: z.object({}),
      assertCompatible: (_plan) => ({ valid: true }),
      calculateBOM: (_plan) => ({ lines: [] }),
      journeyQuestions: questions,
      dp4Rules: rules,
      starterPlan: () => ({})
    });

    registry.register(manifest);

    /** @type {object[] | undefined} */
    let gotQuestions;
    /** @type {object[] | undefined} */
    let gotRules;
    registry.initDomain('init-domain-test', {
      onJourneyQuestions: (qs) => {
        gotQuestions = qs;
      },
      onDp4Rules: (rs) => {
        gotRules = rs;
      }
    });

    assert.deepEqual(gotQuestions, questions);
    assert.deepEqual(gotRules, rules);
    assert.equal(gotQuestions, manifest.journeyQuestions);
    assert.equal(gotRules, manifest.dp4Rules);
  });
});
