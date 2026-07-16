import { z } from 'zod';
import { ModuleSchema } from '@homecraft/contracts';

export const ManufacturerCatalogSchema = z.object({
  manufacturerId: z.string().min(1),
  catalogVersion: z.string().min(1),
  currency: z.literal('RUB').default('RUB'),
  modules: z.array(ModuleSchema).min(1),
  importedAt: z.string().datetime().optional()
});

export type ManufacturerCatalog = z.infer<typeof ManufacturerCatalogSchema>;

export function parseManufacturerCatalog(input: unknown): ManufacturerCatalog {
  return ManufacturerCatalogSchema.parse(input);
}
