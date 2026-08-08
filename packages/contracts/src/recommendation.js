import { z } from 'zod';
import { IntentSchema } from './intent.js';

export const AtomicConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'equals',
    'not_equals',
    'in',
    'not_in',
    'exists',
    'gt',
    'gte',
    'lt',
    'lte'
  ]),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string())
  ])
});

/**
 * Condition: always | atomic | allOf/anyOf (max 3 atomics).
 */
export const ConditionSchema = z.union([
  z.object({ always: z.literal(true) }),
  AtomicConditionSchema,
  z.object({
    allOf: z.array(AtomicConditionSchema).min(1).max(3)
  }),
  z.object({
    anyOf: z.array(AtomicConditionSchema).min(1).max(3)
  })
]);

export const RecommendationActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('filterCatalog'),
    filters: z.record(z.string())
  }),
  z.object({
    type: z.literal('triggerDialogueAction'),
    topic: z.string().min(1)
  })
]);

export const RecommendationRuleSchema = z.object({
  ruleId: z.string().min(1),
  priority: z.number().int(),
  condition: ConditionSchema,
  action: RecommendationActionSchema,
  active: z.boolean()
});

export const RecommendationRuleTableSchema = z.array(RecommendationRuleSchema);

/**
 * DP4 → plan generator ConfigurationIntent (Intent + DP4 metadata).
 */
export const ConfigurationIntentSchema = IntentSchema.extend({
  source: z.literal('dp4').default('dp4'),
  primarySku: z.string().optional(),
  alternativeSkus: z.array(z.string()).default([]),
  dialogueTopic: z.string().optional()
});
