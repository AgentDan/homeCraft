import { z } from 'zod';

export const ConflictKindSchema = z.enum([
  'overlap',
  'dimension_exceeded',
  'clearance_violation',
  'mounting_mismatch',
  'utility_conflict',
  'unsupported_appliance'
]);

export const ConflictSchema = z.object({
  kind: ConflictKindSchema,
  message: z.string(),
  instanceIds: z.array(z.string()).default([]),
  suggestedSkus: z.array(z.string()).default([])
});

export const CompatibilityReportSchema = z.object({
  valid: z.boolean(),
  conflicts: z.array(ConflictSchema),
  checkedAt: z.string().datetime()
});

export function createValidCompatibilityReport() {
  return {
    valid: true,
    conflicts: [],
    checkedAt: new Date().toISOString()
  };
}
