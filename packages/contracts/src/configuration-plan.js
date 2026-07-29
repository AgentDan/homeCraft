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
  plan: ConfigurationPlanSchema,
  branchId: z.string().min(1).default('main'),
  parentVersion: z.number().int().nonnegative().nullable().default(null),
  requestId: z.string().min(1).optional(),
  createdAt: z.string().datetime().optional()
});

export const PlanBranchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Versions committed on this branch (linear undo/redo within the branch). */
  versions: z.array(z.number().int().positive()).default([]),
  /**
   * Index into `versions`. `-1` means sitting on `baseVersion` (fork point)
   * or empty main before the first commit.
   */
  currentIndex: z.number().int().min(-1).default(-1),
  /** Version this branch forked from; null for root `main`. */
  baseVersion: z.number().int().nonnegative().nullable().default(null),
  createdAt: z.string().datetime().optional()
});

const PlanHistoryObjectSchema = z.object({
  projectId: z.string().min(1),
  entries: z.array(PlanVersionEntrySchema).default([]),
  branches: z.array(PlanBranchSchema).default([]),
  activeBranchId: z.string().min(1).default('main'),
  nextVersion: z.number().int().positive().default(1)
});

/**
 * Migrates legacy linear `{ entries, currentIndex }` histories to the tree shape.
 * @param {unknown} raw
 */
export function migratePlanHistory(raw) {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }
  const history = /** @type {Record<string, unknown>} */ (raw);
  if (Array.isArray(history.branches)) {
    return history;
  }
  if (!Array.isArray(history.entries)) {
    return history;
  }

  const legacyEntries = /** @type {Array<Record<string, unknown>>} */ (
    history.entries
  );
  const entries = legacyEntries.map((entry, index) => ({
    ...entry,
    branchId: typeof entry.branchId === 'string' ? entry.branchId : 'main',
    parentVersion:
      entry.parentVersion === undefined
        ? index === 0
          ? null
          : /** @type {{ version?: number }} */ (legacyEntries[index - 1])
              .version ?? null
        : entry.parentVersion
  }));
  const versions = entries
    .map((entry) => entry.version)
    .filter((version) => typeof version === 'number');
  const legacyIndex =
    typeof history.currentIndex === 'number' ? history.currentIndex : -1;

  return {
    projectId: history.projectId,
    entries,
    branches: [
      {
        id: 'main',
        name: 'main',
        versions,
        currentIndex: legacyIndex,
        baseVersion: null,
        createdAt:
          typeof entries[0]?.createdAt === 'string'
            ? entries[0].createdAt
            : undefined
      }
    ],
    activeBranchId: 'main',
    nextVersion:
      typeof history.nextVersion === 'number' ? history.nextVersion : 1
  };
}

export const PlanHistorySchema = z.preprocess(
  migratePlanHistory,
  PlanHistoryObjectSchema
);

export function createEmptyPlan(params) {
  return ConfigurationPlanSchema.parse({
    ...params,
    operations: [],
    createdAt: new Date().toISOString()
  });
}
