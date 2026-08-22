/**
 * Admin validators — reject free-text fields outside schema catalogs.
 */
import {
  ADMIN_ACTION_TYPES,
  ADMIN_CONDITION_OPERATORS,
  ADMIN_DEPENDS_ON_OPERATORS,
  ADMIN_DIALOGUE_TOPICS,
  ADMIN_DIMENSION_UNITS,
  ADMIN_FILTER_KEYS,
  ADMIN_FILTER_PREFER_FROM,
  ADMIN_I18N_KEYS,
  ADMIN_JOURNEY_STAGES,
  ADMIN_VALIDATION_TYPES,
  JourneyQuestionTableSchema,
  RecommendationRuleTableSchema,
  getAdminConditionFields,
  getAdminKnownSlots
} from '@homecraft/contracts';
import { getAdminCatalogFields } from './admin-catalog-live.js';

/**
 * @param {unknown[]} questions
 * @param {string} [productType]
 */
export function validateAdminJourneyQuestions(questions, productType = 'kitchen') {
  const knownSlots = getAdminKnownSlots(productType);
  const parsed = JourneyQuestionTableSchema.parse(questions);
  for (const question of parsed) {
    if (!knownSlots.includes(question.slot)) {
      throw new Error(`slot not in admin catalog: ${question.slot}`);
    }
    if (!knownSlots.includes(question.id)) {
      throw new Error(`id not in admin catalog: ${question.id}`);
    }
    if (!ADMIN_JOURNEY_STAGES.includes(question.stage)) {
      throw new Error(`stage not in admin catalog: ${question.stage}`);
    }
    if (!ADMIN_I18N_KEYS.includes(question.i18nKey)) {
      throw new Error(`i18nKey not in admin catalog: ${question.i18nKey}`);
    }
    if (!ADMIN_VALIDATION_TYPES.includes(question.validation.type)) {
      throw new Error(`validation.type not in admin catalog: ${question.validation.type}`);
    }
    if (
      question.validation.type === 'dimension'
      && !ADMIN_DIMENSION_UNITS.includes(question.validation.unit)
    ) {
      throw new Error(`dimension unit not in admin catalog: ${question.validation.unit}`);
    }
    if (question.dependsOn) {
      if (!knownSlots.includes(question.dependsOn.slot)) {
        throw new Error(`dependsOn.slot not in admin catalog: ${question.dependsOn.slot}`);
      }
      if (!ADMIN_DEPENDS_ON_OPERATORS.includes(question.dependsOn.operator)) {
        throw new Error(
          `dependsOn.operator not in admin catalog: ${question.dependsOn.operator}`
        );
      }
    }
  }
  return parsed;
}

/**
 * @param {import('zod').infer<typeof import('@homecraft/contracts').AtomicConditionSchema>} atomic
 * @param {string[]} conditionFields
 */
function assertAtomicCondition(atomic, conditionFields) {
  if (!conditionFields.includes(atomic.field)) {
    throw new Error(`condition.field not in admin catalog: ${atomic.field}`);
  }
  if (!ADMIN_CONDITION_OPERATORS.includes(atomic.operator)) {
    throw new Error(`condition.operator not in admin catalog: ${atomic.operator}`);
  }
}

/**
 * @param {unknown[]} rules
 * @param {string} [productType]
 */
export async function validateAdminRecommendationRules(rules, productType = 'kitchen') {
  const { filterSkus, filterCategories, finishIds } =
    await getAdminCatalogFields(productType);
  const conditionFields = getAdminConditionFields(productType);
  const parsed = RecommendationRuleTableSchema.parse(rules);
  for (const rule of parsed) {
    const condition = rule.condition;
    if ('always' in condition) {
      // ok
    } else if ('allOf' in condition) {
      for (const item of condition.allOf) assertAtomicCondition(item, conditionFields);
    } else if ('anyOf' in condition) {
      for (const item of condition.anyOf) assertAtomicCondition(item, conditionFields);
    } else {
      assertAtomicCondition(condition, conditionFields);
    }

    if (!ADMIN_ACTION_TYPES.includes(rule.action.type)) {
      throw new Error(`action.type not in admin catalog: ${rule.action.type}`);
    }
    if (rule.action.type === 'triggerDialogueAction') {
      if (!ADMIN_DIALOGUE_TOPICS.includes(rule.action.topic)) {
        throw new Error(`dialogue topic not in admin catalog: ${rule.action.topic}`);
      }
    }
    if (rule.action.type === 'filterCatalog') {
      for (const [key, value] of Object.entries(rule.action.filters)) {
        if (!ADMIN_FILTER_KEYS.includes(key)) {
          throw new Error(`filter key not in admin catalog: ${key}`);
        }
        if (key === 'sku' && !filterSkus.includes(value)) {
          throw new Error(`sku not in admin catalog: ${value}`);
        }
        if (key === 'category' && !filterCategories.includes(value)) {
          throw new Error(`category not in admin catalog: ${value}`);
        }
        if (key === 'preferFrom' && !ADMIN_FILTER_PREFER_FROM.includes(value)) {
          throw new Error(`preferFrom not in admin catalog: ${value}`);
        }
        if (key === 'finishId' && !finishIds.includes(value)) {
          throw new Error(`finishId not in admin catalog: ${value}`);
        }
      }
    }
  }
  return parsed;
}
