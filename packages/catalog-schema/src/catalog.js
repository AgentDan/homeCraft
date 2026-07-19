import { z } from 'zod';
import { ModuleSchema } from '@homecraft/contracts';

export const ManufacturerCatalogSchema = z.object({
  manufacturerId: z.string().min(1),
  catalogVersion: z.string().min(1),
  currency: z.literal('EUR').default('EUR'),
  modules: z.array(ModuleSchema).min(1),
  importedAt: z.string().datetime().optional()
});

export function parseManufacturerCatalog(input) {
  return ManufacturerCatalogSchema.parse(input);
}
