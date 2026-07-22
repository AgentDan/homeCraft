import { z } from 'zod';

export const IntentKindSchema = z.enum([
  'add_module',
  'remove_module',
  'replace_module',
  'change_finish',
  'set_budget',
  'show_price',
  'undo',
  'redo',
  'help',
  'unknown'
]);

export const IntentSlotsSchema = z
  .object({
    widthMm: z.number().positive().optional(),
    budgetEur: z.number().nonnegative().optional(),
    sku: z.string().optional(),
    instanceId: z.string().optional(),
    finishId: z.string().optional(),
    category: z.string().optional(),
    layout: z.string().optional(),
    roomWidthMm: z.number().positive().optional(),
    roomDepthMm: z.number().positive().optional()
  })
  .passthrough()
  .default({});

export const IntentSchema = z.object({
  kind: IntentKindSchema.exclude(['unknown']),
  confidence: z.number().min(0).max(1),
  language: z.literal('en'),
  rawText: z.string(),
  slots: IntentSlotsSchema
});

export const UnknownIntentSchema = z.object({
  kind: z.literal('unknown'),
  language: z.literal('en').optional(),
  rawText: z.string(),
  reason: z.string().default('no_pattern_match')
});

export const IntentResultSchema = z.union([IntentSchema, UnknownIntentSchema]);
