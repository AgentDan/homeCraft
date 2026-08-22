import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import {
  getAdminKnownSlots,
  getAdminSchemaCatalog,
  registry
} from '@homecraft/contracts';
import {
  validateAdminJourneyQuestions,
  validateAdminRecommendationRules
} from './admin-validate.js';
import { buildAdminSchemaCatalog } from './admin-catalog-live.js';

/** Key names + insertion order of the pre-domain-independence GET payload. */
const ADMIN_SCHEMA_CATALOG_KEYS = [
  'journeyStages',
  'validationTypes',
  'dependsOnOperators',
  'knownSlots',
  'i18nKeys',
  'dimensionUnits',
  'enumOptionsBySlot',
  'conditionKinds',
  'conditionFields',
  'conditionOperators',
  'actionTypes',
  'filterKeys',
  'filterSkus',
  'filterCategories',
  'filterPreferFrom',
  'finishIds',
  'dialogueTopics'
];

const DESK_SKU_RULE = [
  {
    ruleId: 'desk_sku',
    priority: 1,
    condition: { always: true },
    action: { type: 'filterCatalog', filters: { sku: 'DESK-1200' } },
    active: true
  }
];

const KITCHEN_SKU_RULE = [
  {
    ruleId: 'kitchen_sku',
    priority: 1,
    condition: { always: true },
    action: { type: 'filterCatalog', filters: { sku: 'BASE-600' } },
    active: true
  }
];

describe('admin-validate', () => {
  before(() => {
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(deskManifest);
    }
  });

  it('accepts seeded journey questions and mandatory rules', async () => {
    const questions = validateAdminJourneyQuestions(
      kitchenManifest.journeyQuestions,
      'kitchen'
    );
    assert.equal(questions.length, kitchenManifest.journeyQuestions.length);
    const rules = await validateAdminRecommendationRules(
      kitchenManifest.dp4Rules,
      'kitchen'
    );
    assert.equal(rules.length, 3);
  });

  it('rejects free-text condition fields', async () => {
    await assert.rejects(
      () =>
        validateAdminRecommendationRules(
          [
            {
              ruleId: 'bad',
              priority: 10,
              condition: {
                field: 'hacked.field',
                operator: 'equals',
                value: 'x'
              },
              action: {
                type: 'filterCatalog',
                filters: { sku: 'BASE-600' }
              },
              active: true
            }
          ],
          'kitchen'
        ),
      /not in admin catalog/
    );
  });

  it('exposes catalog lists synced with schemas', () => {
    const catalog = getAdminSchemaCatalog('kitchen');
    assert.ok(catalog.conditionFields.includes('known.hasKidsOrPets'));
    assert.ok(catalog.conditionOperators.includes('exists'));
    assert.ok(catalog.knownSlots.includes('facadeMaterialPreference'));
    assert.ok(!catalog.conditionFields.includes('arbitrary'));
  });

  it('known slots differ between kitchen and desk', () => {
    const kitchenSlots = getAdminKnownSlots('kitchen');
    const deskSlots = getAdminKnownSlots('desk');
    assert.ok(kitchenSlots.includes('hasKidsOrPets'));
    assert.ok(kitchenSlots.includes('facadeMaterialPreference'));
    assert.ok(!kitchenSlots.includes('deskUsage'));
    assert.ok(deskSlots.includes('deskUsage'));
    assert.ok(deskSlots.includes('clientName'));
    assert.ok(!deskSlots.includes('hasKidsOrPets'));
    assert.throws(
      () => getAdminKnownSlots('not-a-domain'),
      /No manifest registered/
    );
  });

  it('recommendation SKU catalogs are per-domain', async () => {
    await validateAdminRecommendationRules(DESK_SKU_RULE, 'desk');
    await assert.rejects(
      () => validateAdminRecommendationRules(DESK_SKU_RULE, 'kitchen'),
      /sku not in admin catalog: DESK-1200/
    );
    await validateAdminRecommendationRules(KITCHEN_SKU_RULE, 'kitchen');
    await assert.rejects(
      () => validateAdminRecommendationRules(KITCHEN_SKU_RULE, 'desk'),
      /sku not in admin catalog: BASE-600/
    );
  });

  it('buildAdminSchemaCatalog keeps kitchen response key names', async () => {
    const kitchen = await buildAdminSchemaCatalog('kitchen');
    assert.deepEqual(Object.keys(kitchen), ADMIN_SCHEMA_CATALOG_KEYS);
    assert.ok(kitchen.filterSkus.includes('BASE-600'));
    assert.ok(!kitchen.filterSkus.includes('DESK-1200'));
    assert.ok(kitchen.knownSlots.includes('facadeMaterialPreference'));
    assert.deepEqual(kitchen.enumOptionsBySlot.hasKidsOrPets, ['yes', 'no']);

    const desk = await buildAdminSchemaCatalog('desk');
    assert.deepEqual(Object.keys(desk), ADMIN_SCHEMA_CATALOG_KEYS);
    assert.ok(desk.filterSkus.includes('DESK-1200'));
    assert.ok(!desk.filterSkus.includes('BASE-600'));
    assert.ok(desk.knownSlots.includes('deskUsage'));
    assert.ok(!desk.knownSlots.includes('hasKidsOrPets'));
  });
});
