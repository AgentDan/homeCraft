import { z } from 'zod';
import { JourneyQuestionTableSchema } from './journey-question.js';

export { ProductTypeSchema } from './configuration-plan.js';

/**
 * Domain compatibility rule: check(RuleContext) → Conflict[].
 * JSDoc-only import so contracts does not take a runtime dependency on engine.
 * @typedef {(ctx: import('@homecraft/engine').RuleContext) => import('@homecraft/engine').Conflict[]} CompatibilityRule
 */

/** @type {import('zod').ZodType<CompatibilityRule>} */
const CompatibilityRuleSchema = z.custom(
  (value) => typeof value === 'function',
  { message: 'compatibility rule must be a function' }
);

/**
 * Контракт доменного манифеста.
 *
 * Каждый домен (kitchen, desk, wardrobe) экспортирует объект,
 * соответствующий этой схеме, и регистрирует его в ManifestRegistry.
 *
 * ИНВАРИАНТ: assertCompatible и calculateBOM остаются полностью
 * детерминированными — манифест только инкапсулирует их,
 * не добавляет вероятностной логики.
 */
export const ProductManifestSchema = z.object({
  productType: z.string().min(1),
  version: z.string().min(1),

  // Zod-схема доменных слотов (специфика домена).
  // Финальная схема плана = ConfigurationPlanSchema.merge(slotsSchema).
  // Хранится как z.ZodObject — engine вызывает .merge() при необходимости.
  slotsSchema: z.custom((val) => val?._def?.typeName === 'ZodObject', {
    message: 'slotsSchema must be a z.ZodObject'
  }),

  // Детерминированная проверка совместимости.
  // Принимает распаршенный план (уже прошедший merge со slotsSchema).
  assertCompatible: z.function()
    .args(z.record(z.unknown()))
    .returns(z.unknown()),

  // Детерминированный расчёт BOM.
  calculateBOM: z.function()
    .args(z.record(z.unknown()))
    .returns(z.unknown()),

  // Набор правил compatibility-engine для этого домена.
  // Каждое правило: check({ modules, context, index }) → Conflict[].
  // Порядок массива определяет порядок conflicts в отчёте.
  compatibilityRules: z.array(CompatibilityRuleSchema).optional(),

  // Путь к policy.yaml для скоринга кандидатов при конфликте.
  // Если не задан — loadPolicy() берёт kitchen default из packages/manifests.
  policyPath: z.string().optional(),

  // Intent-matching rules for this domain (kind + language matchers).
  // matchIntent() requires this table; missing/empty throws at the call site.
  intentRules: z.array(z.record(z.unknown())).optional(),

  // Domain slot-extraction vocabulary (SKU prefixes, category/finish/layout keywords).
  // If omitted, extractSlots skips sku/category/finishId/layout keyword detection.
  slotVocabulary: z.record(z.unknown()).optional(),

  // Starter-layout operations for slots.layout === 'starter_kitchen' (or domain equivalent).
  // If omitted/empty, generatePlan falls through to the single-candidate add_module flow.
  starterOperations: z.array(z.record(z.unknown())).optional(),

  // Wall-cabinet mount height in mm. If omitted, wall modules are placed at y = 0.
  wallMountHeightMm: z.number().optional(),

  // Default module width fallback in mm when a SKU is missing from the candidate list.
  defaultModuleWidthMm: z.number().optional(),

  // Default site/environment payload for this domain (room shell, niche, etc.).
  // If omitted, the server falls back to a generic defaultRoomShape().
  defaultSite: z.function().optional(),

  // Declarative slot → site path bindings (e.g. roomWidthMm → dimensions.widthMm).
  // Core applySiteBindings() walks this table; empty/omitted is a no-op.
  siteBindings: z.array(z.record(z.unknown())).optional(),

  // Вопросы Discovery-фазы (Journey).
  journeyQuestions: JourneyQuestionTableSchema,

  // Правила DP4-рекомендаций для этого домена.
  dp4Rules: z.array(z.record(z.unknown())),

  // Deterministic DP4 SKU/category mapping (kitchen today; omitted = no DP4 catalog map).
  dp4SkuMap: z.object({
    defaultSku: z.string(),
    defaultCategory: z.string(),
    byFacade: z.record(z.string()).optional(),
    lowBudgetSku: z.string().optional(),
    lowBudgetEur: z.number().optional()
  }).optional(),

  ragStopWords: z.array(z.string()).optional(),
  ragFallbackSku: z.string().optional(),

  // Filesystem path to this domain's manufacturer catalog JSON.
  // Loading stays in apps/server; the manifest only names the file.
  catalogPath: z.string().optional(),

  // Canonical catalog snapshot id for this domain (not a frozen plan reference).
  catalogSnapshotId: z.string().optional(),

  minEnforcedClearanceMm: z.number().optional(),
  maxConnectionDistanceMm: z.number().optional(),
  spatialIndexCellMm: z.number().optional(),
  vatInclusivePercent: z.number().optional(),

  // Начальный план при старте сессии (аналог starterKitchenOperations).
  starterPlan: z.function()
    .args()
    .returns(z.record(z.unknown()))
});

/**
 * JSDoc-typedef for registry.get() / manifest objects.
 * `compatibilityRules` is overridden: Zod's z.function() infers a wide
 * `(Record<string, unknown>) => …` signature that real engine rules cannot
 * assign to (parameter contravariance).
 * @typedef {Omit<import('zod').infer<typeof ProductManifestSchema>, 'compatibilityRules'> & {
 *   compatibilityRules?: CompatibilityRule[]
 * }} ProductManifest
 */
