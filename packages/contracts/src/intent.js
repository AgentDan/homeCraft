import { z } from 'zod';

export const LanguageSchema = z.enum(['en', 'ru', 'sr']);

export const IntentKindSchema = z.enum([
  'add_module',
  'remove_module',
  'replace_module',
  'change_finish',
  'set_budget',
  'show_price',
  'export_project',
  'create_branch',
  'switch_branch',
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
    branchName: z.string().optional()
  })
  .passthrough()
  .default({});

export const IntentSchema = z.object({
  kind: IntentKindSchema.exclude(['unknown']),
  confidence: z.number().min(0).max(1),
  language: LanguageSchema,
  rawText: z.string(),
  slots: IntentSlotsSchema
});

export const UnknownIntentSchema = z.object({
  kind: z.literal('unknown'),
  language: LanguageSchema.optional(),
  rawText: z.string(),
  reason: z.string().default('no_pattern_match')
});

export const IntentResultSchema = z.union([IntentSchema, UnknownIntentSchema]);
