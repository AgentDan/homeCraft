import { z } from 'zod';

/** Stages implemented in phase 4 (1–3) plus terminal `done`. */
export const ProjectJourneyStageSchema = z.enum([
  'intro',
  'brief',
  'survey',
  'done'
]);

export const ProjectJourneyModeSchema = z.enum(['guided', 'free']);

export const ProjectJourneyQuestionRecordSchema = z.object({
  questionId: z.string().min(1),
  askedAt: z.string().datetime(),
  answeredAt: z.string().datetime().optional(),
  reAskCount: z.number().int().nonnegative().default(0)
});

export const ProjectJourneyMetricsSchema = z.object({
  reAskTotal: z.number().int().nonnegative().default(0),
  /** stage → ISO timestamp of first entry */
  stageEnteredAt: z.record(z.string(), z.string()).default({})
});

/**
 * Guided Project Journey state (RoomContext.journey).
 * Slot values live in `known`; `missing` / `deferred` are derived lists for UI/debug.
 */
export const ProjectJourneyStateSchema = z.object({
  stage: ProjectJourneyStageSchema.default('intro'),
  mode: ProjectJourneyModeSchema.default('guided'),
  known: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  missing: z.array(z.string()).default([]),
  deferred: z.array(z.string()).default([]),
  pendingQuestionId: z.string().nullable().default(null),
  questionHistory: z.array(ProjectJourneyQuestionRecordSchema).default([]),
  metrics: ProjectJourneyMetricsSchema.default({
    reAskTotal: 0,
    stageEnteredAt: {}
  })
});

/**
 * @returns {import('zod').infer<typeof ProjectJourneyStateSchema>}
 */
export function createDefaultJourneyState() {
  const now = new Date().toISOString();
  return ProjectJourneyStateSchema.parse({
    stage: 'intro',
    mode: 'guided',
    known: {},
    // Active slots without unmet dependsOn at start (facade skipped until kids/pets=yes).
    missing: [
      'clientName',
      'projectGoal',
      'roomWidthMm',
      'roomDepthMm',
      'hasKidsOrPets',
      'shoppingHabit',
      'socialStyle',
      'budgetEur'
    ],
    deferred: ['openings', 'utilities'],
    pendingQuestionId: null,
    questionHistory: [],
    metrics: {
      reAskTotal: 0,
      stageEnteredAt: { intro: now }
    }
  });
}
