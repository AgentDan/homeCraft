import { z } from 'zod';

/**
 * Observation timeline identity.
 * In HomeCraft Ф0, `clientId` is the consultation key — callers use `projectId`.
 */

export const DialogTurnSchema = z.object({
  clientId: z.string().min(1),
  ts: z.string().datetime(),
  seq: z.number().int().nonnegative(),
  speaker: z.enum(['client', 'agent']),
  text: z.string()
});

export const BehaviorSignalSchema = z.object({
  clientId: z.string().min(1),
  ts: z.string().datetime(),
  seq: z.number().int().nonnegative(),
  eventType: z.enum(['click', 'hover_long', 'reject_variant', 'compare']),
  targetId: z.string().min(1),
  durationMs: z.number().nonnegative()
});

export const ExecutionResultSchema = z.object({
  status: z.enum(['success', 'rejected']),
  reason: z.string().nullable()
});

export const ClientOutcomeSchema = z
  .object({
    status: z.enum(['accepted', 'reverted', 'purchased', 'abandoned']),
    rejectionReason: z.string().nullable()
  })
  .refine(
    (value) =>
      !(
        (value.status === 'reverted' || value.status === 'abandoned')
        && (value.rejectionReason == null || value.rejectionReason.trim() === '')
      ),
    {
      message:
        'rejectionReason is required when clientOutcome.status is reverted or abandoned',
      path: ['rejectionReason']
    }
  );

export const OutcomeSchema = z.object({
  clientId: z.string().min(1),
  ts: z.string().datetime(),
  seq: z.number().int().nonnegative(),
  requestId: z.string().min(1).optional(),
  executionResult: ExecutionResultSchema,
  clientOutcome: ClientOutcomeSchema.nullable()
});

/** Client → server payload; server stamps `ts` + `seq`. */
export const BehaviorSignalInputSchema = BehaviorSignalSchema.omit({
  ts: true,
  seq: true
});

export const ClientOutcomeInputSchema = z.object({
  clientId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  clientOutcome: ClientOutcomeSchema,
  executionResult: ExecutionResultSchema.optional()
});

export const JourneyObservationTypeSchema = z.enum([
  'mode_free',
  're_ask',
  'slot_filled',
  'stage_enter'
]);

export const ObservationKindSchema = z.enum([
  'dialog_turn',
  'behavior_signal',
  'outcome',
  'journey_event'
]);
