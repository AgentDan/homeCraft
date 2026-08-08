import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConditionSchema,
  ConfigurationIntentSchema,
  RecommendationRuleSchema
} from './index.js';

describe('recommendation contracts', () => {
  it('limits allOf/anyOf to 3 atomic conditions', () => {
    assert.throws(() =>
      ConditionSchema.parse({
        allOf: [
          { field: 'a', operator: 'exists', value: true },
          { field: 'b', operator: 'exists', value: true },
          { field: 'c', operator: 'exists', value: true },
          { field: 'd', operator: 'exists', value: true }
        ]
      })
    );
    assert.ok(
      ConditionSchema.parse({
        anyOf: [
          { field: 'a', operator: 'equals', value: 'x' },
          { field: 'b', operator: 'equals', value: 'y' }
        ]
      })
    );
  });

  it('parses always:true and RecommendationRule', () => {
    const rule = RecommendationRuleSchema.parse({
      ruleId: 'default_no_special_conditions',
      priority: 999,
      condition: { always: true },
      action: {
        type: 'filterCatalog',
        filters: { sku: 'BASE-600' }
      },
      active: true
    });
    assert.equal(rule.priority, 999);
  });

  it('parses ConfigurationIntent for DP4', () => {
    const intent = ConfigurationIntentSchema.parse({
      kind: 'add_module',
      confidence: 1,
      language: 'en',
      rawText: '[dp4]',
      slots: { sku: 'BASE-600' },
      source: 'dp4',
      primarySku: 'BASE-600',
      alternativeSkus: ['candidate-1']
    });
    assert.equal(intent.source, 'dp4');
  });
});
