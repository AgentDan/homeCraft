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

export function createEmptyPlan(params) {
  return ConfigurationPlanSchema.parse({
    ...params,
    operations: [],
    createdAt: new Date().toISOString()
  });
}
