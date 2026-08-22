import { z } from 'zod';

export { ProductTypeSchema } from './configuration-plan.js';

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
  compatibilityRules: z.array(
    z.function()
      .args(z.record(z.unknown()))
      .returns(z.array(z.record(z.unknown())))
  ).optional(),

  // Путь к policy.yaml для скоринга кандидатов при конфликте.
  // Если не задан — используется дефолтный apps/server/src/policy/policy.yaml.
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

  // Вопросы Discovery-фазы (Journey).
  journeyQuestions: z.array(z.record(z.unknown())),

  // Правила DP4-рекомендаций для этого домена.
  dp4Rules: z.array(z.record(z.unknown())),

  // Начальный план при старте сессии (аналог starterKitchenOperations).
  starterPlan: z.function()
    .args()
    .returns(z.record(z.unknown()))
});

/**
 * JSDoc-typedef для использования в JS без TypeScript.
 * Выводится напрямую из схемы, чтобы registry и результат `.parse()`
 * всегда имели один тип.
 * @typedef {import('zod').infer<typeof ProductManifestSchema>} ProductManifest
 */
