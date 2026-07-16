import { z } from 'zod';

export const BOMLineSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceRub: z.number().nonnegative(),
  lineTotalRub: z.number().nonnegative(),
  finishId: z.string().optional()
});

export type BOMLine = z.infer<typeof BOMLineSchema>;

export const BOMSchema = z.object({
  catalogSnapshotId: z.string(),
  lines: z.array(BOMLineSchema),
  subtotalRub: z.number().nonnegative(),
  vatRub: z.number().nonnegative(),
  totalRub: z.number().nonnegative(),
  calculatedAt: z.string().datetime()
});

export type BOM = z.infer<typeof BOMSchema>;

export function createEmptyBOM(catalogSnapshotId: string): BOM {
  return {
    catalogSnapshotId,
    lines: [],
    subtotalRub: 0,
    vatRub: 0,
    totalRub: 0,
    calculatedAt: new Date().toISOString()
  };
}
