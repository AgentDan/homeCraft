import { z } from 'zod';

export const PlanOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_module'),
    sku: z.string().min(1),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rotationY: z.number().default(0)
  }),
  z.object({
    type: z.literal('remove_module'),
    instanceId: z.string().min(1)
  }),
  z.object({
    type: z.literal('move_module'),
    instanceId: z.string().min(1),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    rotationY: z.number().optional()
  }),
  z.object({
    type: z.literal('change_finish'),
    instanceId: z.string().min(1),
    finishId: z.string().min(1)
  }),
  z.object({
    type: z.literal('replace_module'),
    instanceId: z.string().min(1),
    sku: z.string().min(1)
  })
]);

export const ConfigurationPlanSchema = z.object({
  planId: z.string().min(1),
  projectId: z.string().min(1),
  catalogSnapshotId: z.string().min(1),
  operations: z.array(PlanOperationSchema),
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
