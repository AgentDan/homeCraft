import { z } from 'zod';

export const BOMLineSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceEur: z.number().nonnegative(),
  lineTotalEur: z.number().nonnegative(),
  finishId: z.string().optional()
});

export const BOMSchema = z.object({
  catalogSnapshotId: z.string(),
  lines: z.array(BOMLineSchema),
  subtotalEur: z.number().nonnegative(),
  vatEur: z.number().nonnegative(),
  totalEur: z.number().nonnegative(),
  calculatedAt: z.string().datetime()
});