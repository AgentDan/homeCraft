import { z } from 'zod';
import { createEmptyPlan } from '@homecraft/contracts';
import { assertCompatible } from '../../../apps/server/src/compatibility-engine/assertCompatible.js';
import { calculateBOM } from '../../../apps/server/src/pricing-engine/calculateBOM.js';
import { DEFAULT_JOURNEY_QUESTIONS } from '../../../apps/server/src/core/journey-table.js';
import {
  MANDATORY_RECOMMENDATION_RULES
} from '../../../apps/server/src/core/recommendation-engine.js';
import { check as dimensionsRule } from '../../../apps/server/src/compatibility-engine/rules/dimensions.js';
import { check as mountingRule } from '../../../apps/server/src/compatibility-engine/rules/mounting.js';
import { check as overlapRule } from '../../../apps/server/src/compatibility-engine/rules/overlap.js';
import { check as utilitiesRule } from '../../../apps/server/src/compatibility-engine/rules/utilities.js';
import { check as clearancesRule } from '../../../apps/server/src/compatibility-engine/rules/clearances.js';

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

  journeyQuestions: DEFAULT_JOURNEY_QUESTIONS,
  dp4Rules: MANDATORY_RECOMMENDATION_RULES,

  starterPlan: () => createEmptyPlan({
    planId: crypto.randomUUID(),
    projectId: 'starter',
    productType: 'kitchen',
    catalogSnapshotId: 'default'
  })
};
