import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyPlan, JourneyQuestionTableSchema } from '@homecraft/contracts';
import { assertCompatible } from '../../../apps/server/src/compatibility-engine/assertCompatible.js';
import { calculateBOM } from '../../../apps/server/src/pricing-engine/calculateBOM.js';
import { check as dimensionsRule } from './compatibility-rules/dimensions.js';
import { check as overlapRule } from './compatibility-rules/overlap.js';
import { deskIntentRules } from './intent-rules.js';
import { deskDefaultSite, deskSiteBindings } from './site.js';

/** Desk catalog has no mounting/utilities/clearances fields — only spatial rules. */
const compatibilityRules = [
  dimensionsRule,
  overlapRule
];

const policyPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  './policy.yaml'
);

const catalogPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/server/src/knowledge-base/data/source/desk-catalog.json'
);

/**
 * Stub desk journey questions.
 * Минимум для валидного манифеста — заменить реальными вопросами позже.
 */
const DESK_JOURNEY_QUESTIONS = JourneyQuestionTableSchema.parse([
  {
    id: 'clientName',
    slot: 'clientName',
    stage: 'intro',
    order: 10,
    i18nKey: 'journeyAskClientName',
    validation: { type: 'text', minLength: 1, maxLength: 80, rejectIfNumeric: true },
    dependsOn: null,
    active: true
  },
  {
    id: 'deskUsage',
    slot: 'deskUsage',
    stage: 'brief',
    order: 20,
    i18nKey: 'journeyAskDeskUsage',
    validation: { type: 'text', minLength: 2, maxLength: 240 },
    dependsOn: null,
    active: true
  },
  {
    id: 'roomWidthMm',
    slot: 'roomWidthMm',
    stage: 'survey',
    order: 30,
    i18nKey: 'journeyAskRoomWidth',
    validation: { type: 'dimension', min: 500, max: 20000, unit: 'mm', acceptNlu: true },
    dependsOn: null,
    active: true
  }
]);

/** @type {import('zod').infer<typeof import('@homecraft/contracts').ProductManifestSchema>} */
export const deskManifest = {
  productType: 'desk',
  version: '0.1.0',

  // Desk пока использует базовый ConfigurationPlanSchema без расширений.
  slotsSchema: z.object({}),

  compatibilityRules,

  policyPath,
  catalogPath,
  catalogSnapshotId: 'desk-demo-v1',

  // assertCompatible и calculateBOM универсальны — работают через catalog SKU.
  assertCompatible: (plan, context) =>
    assertCompatible(plan, context, { compatibilityRules, manifest: deskManifest }),
  calculateBOM: (plan, catalogSnapshotId) =>
    calculateBOM(plan, catalogSnapshotId, deskManifest),

  intentRules: deskIntentRules,

  // Same numbers as kitchen for now — desk has no domain-specific
  // clearances/utilities/VAT of its own yet (same precedent as defaultSite).
  minEnforcedClearanceMm: 20,
  maxConnectionDistanceMm: 900,
  spatialIndexCellMm: 1000,
  vatInclusivePercent: 20,

  defaultSite: deskDefaultSite,
  siteBindings: deskSiteBindings,

  journeyQuestions: DESK_JOURNEY_QUESTIONS,

  // Пустые DP4 rules — добавить позже.
  dp4Rules: [],

  starterPlan: () => createEmptyPlan({
    planId: crypto.randomUUID(),
    projectId: 'starter',
    productType: 'desk',
    catalogSnapshotId: 'desk-demo-v1'
  })
};
