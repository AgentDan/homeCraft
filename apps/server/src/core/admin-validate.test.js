import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import {
  validateAdminJourneyQuestions,
  validateAdminRecommendationRules
} from './admin-validate.js';
import { getAdminSchemaCatalog } from '@homecraft/contracts';

describe('admin-validate', () => {
  it('accepts seeded journey questions and mandatory rules', () => {
    const questions = validateAdminJourneyQuestions(kitchenManifest.journeyQuestions);
    assert.equal(questions.length, kitchenManifest.journeyQuestions.length);
    const rules = validateAdminRecommendationRules(kitchenManifest.dp4Rules);
    assert.equal(rules.length, 3);
  });

  it('rejects free-text condition fields', () => {
    assert.throws(
      () =>
        validateAdminRecommendationRules([
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
        ]),
      /not in admin catalog/
    );
  });

  it('exposes catalog lists synced with schemas', () => {
    const catalog = getAdminSchemaCatalog();
    assert.ok(catalog.conditionFields.includes('known.hasKidsOrPets'));
    assert.ok(catalog.conditionOperators.includes('exists'));
    assert.ok(catalog.knownSlots.includes('facadeMaterialPreference'));
    assert.ok(!catalog.conditionFields.includes('arbitrary'));
  });
});
