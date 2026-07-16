import { z } from 'zod';

export const BOMLineSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceRub: z.number().nonnegative(),
  lineTotalRub: z.number().nonnegative(),
  finishId: z.string().optional()
});

export const BOMSchema = z.object({
  catalogSnapshotId: z.string(),
  lines: z.array(BOMLineSchema),
  subtotalRub: z.number().nonnegative(),
  vatRub: z.number().nonnegative(),
  totalRub: z.number().nonnegative(),
  calculatedAt: z.string().datetime()
});

export function createEmptyBOM(catalogSnapshotId) {
  return {
    catalogSnapshotId,
    lines: [],
    subtotalRub: 0,
    vatRub: 0,
    totalRub: 0,
    calculatedAt: new Date().toISOString()
  };
}
