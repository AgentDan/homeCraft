/**
 * Kitchen DP4 recommendation rules (domain data, not core engine logic).
 * Filters reference kitchen catalog (`category: 'base_cabinet'`, `sku: 'BASE-600'`).
 * Core recommendation-engine.js evaluates this table after registry.initDomain()
 * copies it into the live activeRules array.
 */
import { RecommendationRuleTableSchema } from '@homecraft/contracts';

export const kitchenDp4Rules = RecommendationRuleTableSchema.parse([
  {
    ruleId: 'explicit_answer_wins_over_behavior',
    priority: 1,
    condition: {
      anyOf: [
        {
          field: 'known.facadeMaterialPreference',
          operator: 'exists',
          value: true
        },
        { field: 'known.budgetEur', operator: 'exists', value: true },
        { field: 'known.socialStyle', operator: 'exists', value: true }
      ]
    },
    action: {
      type: 'filterCatalog',
      filters: { preferFrom: 'known', category: 'base_cabinet' }
    },
    active: true
  },
  {
    ruleId: 'conflicting_behavior_becomes_alternative',
    priority: 2,
    condition: {
      allOf: [
        {
          field: 'decisionState.focusVariantIds',
          operator: 'exists',
          value: true
        },
        {
          field: 'known.facadeMaterialPreference',
          operator: 'exists',
          value: true
        }
      ]
    },
    action: {
      type: 'triggerDialogueAction',
      topic: 'behavior_as_alternative'
    },
    active: true
  },
  {
    ruleId: 'default_no_special_conditions',
    priority: 999,
    condition: { always: true },
    action: {
      type: 'filterCatalog',
      filters: { sku: 'BASE-600', category: 'base_cabinet' }
    },
    active: true
  }
]);
