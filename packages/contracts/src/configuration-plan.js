import { z } from 'zod';
import { PlanOperationSchema } from './client-request.js';

export const ConfigurationPlanSchema = z.object({
  planId: z.string().min(1),
  projectId: z.string().min(1),
  catalogSnapshotId: z.string().min(1),
  operations: z.array(PlanOperationSchema),
  sourceInputMode: z.enum(['dialog', 'editor']),
  createdAt: z.string().datetime()
});

export const PlanVersionEntrySchema = z.object({
  version: z.number().int().nonnegative(),
  plan: ConfigurationPlanSchema
});

export const PlanHistorySchema = z.object({
  projectId: z.string().min(1),
  entries: z.array(PlanVersionEntrySchema).default([]),
  currentIndex: z.number().int().min(-1).default(-1),
  nextVersion: z.number().int().positive().default(1)
});

export function createEmptyPlan(params) {
  return ConfigurationPlanSchema.parse({
    ...params,
    operations: [],
    createdAt: new Date().toISOString()
  });
}
