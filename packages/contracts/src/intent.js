import { z } from 'zod';

export const IntentKindSchema = z.enum([
  'add_module',
  'remove_module',
  'change_finish',
  'set_budget',
  'show_price',
  'undo',
  'redo',
  'help',
  'unknown'
]);

export const IntentSchema = z.object({
  kind: IntentKindSchema.exclude(['unknown']),
  confidence: z.number().min(0).max(1),
  language: z.literal('en'),
  rawText: z.string(),
  slots: z.record(z.unknown()).default({})
});

export const UnknownIntentSchema = z.object({
  kind: z.literal('unknown'),
  language: z.literal('en').optional(),
  rawText: z.string(),
  reason: z.string().default('no_pattern_match')
});

export const IntentResultSchema = z.union([IntentSchema, UnknownIntentSchema]);
