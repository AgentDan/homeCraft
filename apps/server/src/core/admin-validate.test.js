import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_JOURNEY_QUESTIONS
} from './journey-table.js';
import {
  MANDATORY_RECOMMENDATION_RULES
} from './recommendation-engine.js';
import {
  validateAdminJourneyQuestions,
  validateAdminRecommendationRules
} from './admin-validate.js';
import { getAdminSchemaCatalog } from '@homecraft/contracts';

describe('admin-validate', () => {
  it('accepts seeded journey questions and mandatory rules', () => {
    const questions = validateAdminJourneyQuestions(DEFAULT_JOURNEY_QUESTIONS);
    assert.equal(questions.length, DEFAULT_JOURNEY_QUESTIONS.length);
    const rules = validateAdminRecommendationRules(MANDATORY_RECOMMENDATION_RULES);
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
