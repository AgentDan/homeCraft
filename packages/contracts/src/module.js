import { z } from 'zod';

export const MountingKindSchema = z.enum(['floor', 'wall', 'tall', 'corner']);

export const ClearancesSchema = z.object({
  topMm: z.number().nonnegative(),
  bottomMm: z.number().nonnegative(),
  leftMm: z.number().nonnegative(),
  rightMm: z.number().nonnegative(),
  backMm: z.number().nonnegative()
});

export const ModuleDimensionsSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive()
});

export const FinishOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceDeltaEur: z.number()
});

export const ModuleSchema = z.object({
  sku: z.string().min(1),
  name: z.string(),
  category: z.string(),
  dimensions: ModuleDimensionsSchema,
  priceEur: z.number().nonnegative(),
  mounting: MountingKindSchema,
  clearances: ClearancesSchema,
  finishes: z.array(FinishOptionSchema),
  utilities: z.array(z.enum(['water', 'gas', 'electric', 'drain'])).default([])
});

export const RetrievedModuleSchema = ModuleSchema.extend({
  score: z.number().min(0).max(1),
  source: z.string().optional()
});
