import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeCatalog } from '@homecraft/catalog-schema';

export const DEFAULT_CATALOG_SNAPSHOT_ID = 'kitchen-demo-v1';

const catalogPath = fileURLToPath(
  new URL('./data/source/kitchen-catalog.json', import.meta.url)
);

/** @type {ReturnType<typeof normalizeCatalog> | null} */
let cachedCatalog = null;

export async function loadDemoCatalog() {
  if (cachedCatalog) {
    return structuredClone(cachedCatalog);
  }

  const raw = JSON.parse(await readFile(catalogPath, 'utf8'));
  cachedCatalog = normalizeCatalog(raw);
  return structuredClone(cachedCatalog);
}

export async function getCatalogSnapshot(snapshotId = DEFAULT_CATALOG_SNAPSHOT_ID) {
  const catalog = await loadDemoCatalog();
  if (snapshotId !== catalog.catalogVersion) {
    throw new Error(`Catalog snapshot "${snapshotId}" was not found.`);
  }
  return catalog;
}

export async function getCatalogModule(snapshotId, sku) {
  const catalog = await getCatalogSnapshot(snapshotId);
  return catalog.modules.find((module) => module.sku === sku) ?? null;
}
