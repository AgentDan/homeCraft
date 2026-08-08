import { z } from 'zod';
import { BehaviorSignalSchema } from './observation.js';

export const DecisionPhaseSchema = z.enum([
  'intro',
  'brief',
  'survey',
  'post_survey'
]);

export const DecisionRejectedIdSchema = z.object({
  variantId: z.string().min(1),
  reason: z.string().nullable()
});

/**
 * Decision State v0 — derived from Observation + journey snapshot (no ML).
 * `journeyMode` mirrors `journey.mode`; `post_survey` is assigned outside dialog-router
 * when `journey.stage === 'done'`.
 */
export const DecisionStateSchema = z.object({
  clientId: z.string().min(1),
  phase: DecisionPhaseSchema.default('intro'),
  journeyMode: z.enum(['guided', 'free']).default('guided'),
  focusVariantIds: z.array(z.string().min(1)).default([]),
  rejectedIds: z.array(DecisionRejectedIdSchema).default([]),
  topConcerns: z.array(z.string().min(1)).default([]),
  readinessScore: z.number().min(0).max(1).default(0),
  lastSignals: z.array(BehaviorSignalSchema).default([])
});

/**
 * Minimal ClientProfile — filled manually (admin API); not inferred from dialog text.
 */
export const ClientProfileSchema = z.object({
  clientId: z.string().min(1),
  emotionalDriver: z.string().nullable().default(null),
  valueWeights: z.record(z.number()).default({}),
  budgetAnchor: z.number().nullable().default(null),
  segment: z.string().nullable().default(null),
  updatedAt: z.string().datetime().optional()
});
