import { z } from 'zod';
import { createEmptyPlan } from '@homecraft/contracts';
import { assertCompatible } from '../../../apps/server/src/compatibility-engine/assertCompatible.js';
import { calculateBOM } from '../../../apps/server/src/pricing-engine/calculateBOM.js';
import { check as dimensionsRule } from './compatibility-rules/dimensions.js';
import { check as mountingRule } from './compatibility-rules/mounting.js';
import { check as overlapRule } from './compatibility-rules/overlap.js';
import { check as utilitiesRule } from './compatibility-rules/utilities.js';
import { check as clearancesRule } from './compatibility-rules/clearances.js';
import { kitchenIntentRules } from './intent-rules.js';
import { kitchenSlotVocabulary } from './slot-vocabulary.js';
import { kitchenStarterOperations } from './starter-operations.js';
import { kitchenJourneyQuestions } from './journey-questions.js';
import { kitchenDp4Rules } from './dp4-rules.js';

const compatibilityRules = [
  dimensionsRule,
  mountingRule,
  overlapRule,
  utilitiesRule,
  clearancesRule
];

/**
 * Первый доменный манифест. Здесь только ссылки на существующую
 * детерминированную кухонную реализацию — без новой бизнес-логики.
 * @type {import('zod').infer<typeof import('@homecraft/contracts').ProductManifestSchema>}
 */
export const kitchenManifest = {
  productType: 'kitchen',
  version: '1.0.0',

  // Кухня пока использует базовый ConfigurationPlanSchema без расширений.
  slotsSchema: z.object({}),

  compatibilityRules,

  assertCompatible: (plan, ...args) =>
    assertCompatible(plan, args[0], { compatibilityRules }),
  calculateBOM: (plan, ...args) =>
    calculateBOM(plan, /** @type {string} */ (args[0])),

  intentRules: kitchenIntentRules,
  slotVocabulary: kitchenSlotVocabulary,
  starterOperations: kitchenStarterOperations,
  wallMountHeightMm: 1400,
  defaultModuleWidthMm: 600,

  journeyQuestions: kitchenJourneyQuestions,
  dp4Rules: kitchenDp4Rules,

  starterPlan: () => createEmptyPlan({
    planId: crypto.randomUUID(),
    projectId: 'starter',
    productType: 'kitchen',
    catalogSnapshotId: 'default'
  })
};
