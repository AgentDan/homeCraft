import { z } from 'zod';

export const JourneyQuestionStageSchema = z.enum(['intro', 'brief', 'survey']);

export const ValidationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    minLength: z.number(),
    maxLength: z.number(),
    rejectIfNumeric: z.boolean().optional()
  }),
  z.object({
    type: z.literal('number'),
    min: z.number(),
    max: z.number(),
    integer: z.boolean().optional()
  }),
  z.object({
    type: z.literal('enum'),
    options: z.array(z.string()).min(1),
    allowMultiple: z.boolean().optional()
  }),
  z.object({
    type: z.literal('dimension'),
    min: z.number(),
    max: z.number(),
    unit: z.string().min(1),
    acceptNlu: z.boolean().optional()
  })
]);

export const DependsOnSchema = z.object({
  slot: z.string().min(1),
  operator: z.enum(['equals', 'not_equals', 'in', 'not_in']),
  value: z.union([z.string(), z.array(z.string())])
});

/**
 * Typed journey question (Ф1).
 * `id` is the pendingQuestionId key (seed: same as `slot`).
 */
export const JourneyQuestionSchema = z.object({
  id: z.string().min(1),
  slot: z.string().min(1),
  stage: JourneyQuestionStageSchema,
  order: z.number().int().nonnegative(),
  i18nKey: z.string().min(1),
  validation: ValidationSchema,
  dependsOn: DependsOnSchema.nullable(),
  active: z.boolean()
});

/**
 * Full table: dependsOn.slot must refer to an earlier question (lower order).
 */
export const JourneyQuestionTableSchema = z
  .array(JourneyQuestionSchema)
  .superRefine((questions, ctx) => {
    const bySlot = new Map(questions.map((q) => [q.slot, q]));
    for (const question of questions) {
      if (!question.dependsOn) continue;
      const parent = bySlot.get(question.dependsOn.slot);
      if (!parent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `dependsOn.slot "${question.dependsOn.slot}" not found`,
          path: [questions.indexOf(question), 'dependsOn', 'slot']
        });
        continue;
      }
      if (parent.order >= question.order) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `dependsOn.slot "${question.dependsOn.slot}" must have lower order than "${question.slot}"`,
          path: [questions.indexOf(question), 'dependsOn', 'slot']
        });
      }
    }
  });
