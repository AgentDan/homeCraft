import { ManufacturerCatalogSchema } from './catalog.js';

export function normalizeCatalog(raw) {
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
