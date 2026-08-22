/**
 * Admin UI catalogs — synced with JourneyQuestion (Ф1) and RecommendationRule (Ф3).
 * Field names are closed lists; the UI must not accept free-text field entry.
 */

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

/** Kitchen journey slots allowed in the admin UI (Ф1 seed + closed kitchen set). */
export const ADMIN_KNOWN_SLOTS = Object.freeze([
  'clientName',
  'projectGoal',
  'roomWidthMm',
  'roomDepthMm',
  'hasKidsOrPets',
  'facadeMaterialPreference',
  'shoppingHabit',
  'socialStyle',
  'budgetEur'
]);

/** Kitchen condition `field` paths for recommendation rules (Ф2/Ф3 context). */
export const ADMIN_CONDITION_FIELDS = Object.freeze([
  'phase',
  'known.clientName',
  'known.projectGoal',
  'known.roomWidthMm',
  'known.roomDepthMm',
  'known.hasKidsOrPets',
  'known.facadeMaterialPreference',
  'known.shoppingHabit',
  'known.socialStyle',
  'known.budgetEur',
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
export const ADMIN_FILTER_SKUS = Object.freeze([
  'BASE-400',
  'BASE-600',
  'BASE-800',
  'DRAWER-400',
  'DRAWER-600',
  'SINK-600',
  'WALL-600',
  'WALL-800'
]);

/** @type {readonly string[]} */
export const ADMIN_FILTER_CATEGORIES = Object.freeze([
  'base_cabinet',
  'drawer_cabinet',
  'sink_cabinet',
  'wall_cabinet',
  'tall_cabinet'
]);

/** @type {readonly string[]} */
export const ADMIN_FILTER_PREFER_FROM = Object.freeze(['known']);

/** @type {readonly string[]} */
export const ADMIN_FINISH_IDS = Object.freeze(['white', 'oak']);

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

/** Enum option pools keyed by slot (for dependsOn value + enum validation). */
export const ADMIN_ENUM_OPTIONS_BY_SLOT = Object.freeze({
  hasKidsOrPets: Object.freeze(['yes', 'no']),
  facadeMaterialPreference: Object.freeze(['durable', 'soft', 'mixed']),
  shoppingHabit: Object.freeze(['browse', 'decide_fast', 'research']),
  socialStyle: Object.freeze(['private', 'hosting', 'family'])
});

/**
 * Full catalog payload for GET /api/admin/schema-catalog.
 */
export function getAdminSchemaCatalog() {
  return {
    journeyStages: [...ADMIN_JOURNEY_STAGES],
    validationTypes: [...ADMIN_VALIDATION_TYPES],
    dependsOnOperators: [...ADMIN_DEPENDS_ON_OPERATORS],
    knownSlots: [...ADMIN_KNOWN_SLOTS],
    i18nKeys: [...ADMIN_I18N_KEYS],
    dimensionUnits: [...ADMIN_DIMENSION_UNITS],
    enumOptionsBySlot: structuredClone(ADMIN_ENUM_OPTIONS_BY_SLOT),
    conditionKinds: [...ADMIN_CONDITION_KINDS],
    conditionFields: [...ADMIN_CONDITION_FIELDS],
    conditionOperators: [...ADMIN_CONDITION_OPERATORS],
    actionTypes: [...ADMIN_ACTION_TYPES],
    filterKeys: [...ADMIN_FILTER_KEYS],
    filterSkus: [...ADMIN_FILTER_SKUS],
    filterCategories: [...ADMIN_FILTER_CATEGORIES],
    filterPreferFrom: [...ADMIN_FILTER_PREFER_FROM],
    finishIds: [...ADMIN_FINISH_IDS],
    dialogueTopics: [...ADMIN_DIALOGUE_TOPICS]
  };
}
