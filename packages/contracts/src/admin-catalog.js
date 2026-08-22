/**
 * Admin UI catalogs — synced with JourneyQuestion (Ф1) and RecommendationRule (Ф3).
 * Field names are closed lists; the UI must not accept free-text field entry.
 */

import { registry } from './manifest-registry.js';

/** @type {readonly string[]} */
export const ADMIN_JOURNEY_STAGES = Object.freeze(['intro', 'brief', 'survey']);

/** @type {readonly string[]} */
export const ADMIN_VALIDATION_TYPES = Object.freeze([
  'text',
  'number',
  'enum',
  'dimension'
]);

/** @type {readonly string[]} */
export const ADMIN_DEPENDS_ON_OPERATORS = Object.freeze([
  'equals',
  'not_equals',
  'in',
  'not_in'
]);

/** @type {readonly string[]} */
export const ADMIN_CONDITION_OPERATORS = Object.freeze([
  'equals',
  'not_equals',
  'in',
  'not_in',
  'exists',
  'gt',
  'gte',
  'lt',
  'lte'
]);

/**
 * Platform DecisionState / ClientProfile condition paths (not domain nouns).
 * Concatenated with `known.${slot}` from the registered manifest.
 * @type {readonly string[]}
 */
const ADMIN_PLATFORM_CONDITION_FIELDS = Object.freeze([
  'phase',
  'decisionState.phase',
  'decisionState.journeyMode',
  'decisionState.focusVariantIds',
  'decisionState.readinessScore',
  'decisionState.topConcerns',
  'clientProfile.segment',
  'clientProfile.emotionalDriver',
  'clientProfile.budgetAnchor'
]);

/** @type {readonly string[]} */
export const ADMIN_CONDITION_KINDS = Object.freeze([
  'always',
  'atomic',
  'allOf',
  'anyOf'
]);

/** @type {readonly string[]} */
export const ADMIN_ACTION_TYPES = Object.freeze([
  'filterCatalog',
  'triggerDialogueAction'
]);

/** @type {readonly string[]} */
export const ADMIN_FILTER_KEYS = Object.freeze([
  'sku',
  'category',
  'preferFrom',
  'finishId'
]);

/** @type {readonly string[]} */
export const ADMIN_FILTER_PREFER_FROM = Object.freeze(['known']);

/** @type {readonly string[]} */
export const ADMIN_DIALOGUE_TOPICS = Object.freeze([
  'behavior_as_alternative',
  'primary_from_known',
  'default'
]);

/** @type {readonly string[]} */
export const ADMIN_I18N_KEYS = Object.freeze([
  'journeyAskClientName',
  'journeyAskProjectGoal',
  'journeyAskRoomWidth',
  'journeyAskRoomDepth',
  'journeyAskHasKidsOrPets',
  'journeyAskFacadeMaterial',
  'journeyAskShoppingHabit',
  'journeyAskSocialStyle',
  'journeyAskBudgetEur'
]);

/** @type {readonly string[]} */
export const ADMIN_DIMENSION_UNITS = Object.freeze(['mm', 'm']);

/**
 * Journey-question slot names for the registered domain.
 * Unregistered productType throws from registry.get — admin must not silently
 * accept an unknown domain.
 * @param {string} productType
 * @returns {string[]}
 */
export function getAdminKnownSlots(productType) {
  return registry.get(productType).journeyQuestions.map((question) => question.slot);
}

/**
 * Closed condition.field list: platform DecisionState/ClientProfile paths plus
 * `known.${slot}` for each journey slot of the registered domain.
 * @param {string} productType
 * @returns {string[]}
 */
export function getAdminConditionFields(productType) {
  return [
    ...ADMIN_PLATFORM_CONDITION_FIELDS,
    ...getAdminKnownSlots(productType).map((slot) => `known.${slot}`)
  ];
}

/**
 * Enum option pools keyed by slot, taken from JourneyQuestion.validation.options.
 * @param {string} productType
 * @returns {Record<string, string[]>}
 */
export function getAdminEnumOptionsBySlot(productType) {
  /** @type {Record<string, string[]>} */
  const bySlot = {};
  for (const question of registry.get(productType).journeyQuestions) {
    if (question.validation?.type === 'enum') {
      bySlot[question.slot] = [...question.validation.options];
    }
  }
  return bySlot;
}

/**
 * Synchronous schema catalog (Bucket A + Bucket B). Catalog SKUs/categories/
 * finishes are merged in by apps/server after catalog file I/O.
 * @param {string} productType
 */
export function getAdminSchemaCatalog(productType) {
  return {
    journeyStages: [...ADMIN_JOURNEY_STAGES],
    validationTypes: [...ADMIN_VALIDATION_TYPES],
    dependsOnOperators: [...ADMIN_DEPENDS_ON_OPERATORS],
    knownSlots: getAdminKnownSlots(productType),
    i18nKeys: [...ADMIN_I18N_KEYS],
    dimensionUnits: [...ADMIN_DIMENSION_UNITS],
    enumOptionsBySlot: getAdminEnumOptionsBySlot(productType),
    conditionKinds: [...ADMIN_CONDITION_KINDS],
    conditionFields: getAdminConditionFields(productType),
    conditionOperators: [...ADMIN_CONDITION_OPERATORS],
    actionTypes: [...ADMIN_ACTION_TYPES],
    filterKeys: [...ADMIN_FILTER_KEYS],
    filterPreferFrom: [...ADMIN_FILTER_PREFER_FROM],
    dialogueTopics: [...ADMIN_DIALOGUE_TOPICS]
  };
}
