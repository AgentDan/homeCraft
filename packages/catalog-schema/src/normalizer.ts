import type { ManufacturerCatalog } from './catalog.js';
import { ManufacturerCatalogSchema } from './catalog.js';

/**
 * Normalizes raw manufacturer catalog JSON. Step0: validates only.
 *
 * @param raw - Unknown catalog payload from import pipeline
 * @returns Validated catalog
 * @throws ZodError when validation fails
 */
export function normalizeCatalog(raw: unknown): ManufacturerCatalog {
  const parsed = ManufacturerCatalogSchema.parse(raw);
  return {
    ...parsed,
    modules: parsed.modules.map((module) => ({
      ...module,
      sku: module.sku.trim(),
      name: module.name.trim()
    }))
  };
}
