import { z } from 'zod';

export const IntentKindSchema = z.enum([
  'add_module',
  'remove_module',
  'change_finish',
  'set_budget',
  'show_price',
  'help',
  'unknown'
]);

export type IntentKind = z.infer<typeof IntentKindSchema>;

export const IntentSchema = z.object({
  kind: IntentKindSchema.exclude(['unknown']),
  confidence: z.number().min(0).max(1),
  language: z.enum(['ru', 'en']),
  rawText: z.string(),
  slots: z.record(z.unknown()).default({})
});

export type Intent = z.infer<typeof IntentSchema>;

export const UnknownIntentSchema = z.object({
  kind: z.literal('unknown'),
  language: z.enum(['ru', 'en']).optional(),
  rawText: z.string(),
  reason: z.string().default('no_pattern_match')
});

export type UnknownIntent = z.infer<typeof UnknownIntentSchema>;

export const IntentResultSchema = z.union([IntentSchema, UnknownIntentSchema]);
export type IntentResult = z.infer<typeof IntentResultSchema>;
