import { z } from 'zod';

export const ConflictKindSchema = z.enum([
  'overlap',
  'dimension_exceeded',
  'clearance_violation',
  'mounting_mismatch',
  'utility_conflict',
  'unsupported_appliance'
]);

export type ConflictKind = z.infer<typeof ConflictKindSchema>;

export const ConflictSchema = z.object({
  kind: ConflictKindSchema,
  message: z.string(),
  instanceIds: z.array(z.string()).default([]),
  suggestedSkus: z.array(z.string()).default([])
});

export type Conflict = z.infer<typeof ConflictSchema>;

export const CompatibilityReportSchema = z.object({
  valid: z.boolean(),
  conflicts: z.array(ConflictSchema),
  checkedAt: z.string().datetime()
});

export type CompatibilityReport = z.infer<typeof CompatibilityReportSchema>;

export function createValidCompatibilityReport(): CompatibilityReport {
  return {
    valid: true,
    conflicts: [],
    checkedAt: new Date().toISOString()
  };
}
