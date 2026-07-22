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

/**
 * Lists frozen catalog snapshots available for pricing / BOM.
 * @returns {Promise<Array<{
 *   id: string,
 *   moduleCount: number,
 *   currency: string,
 *   default: boolean
 * }>>}
 */
export async function listCatalogSnapshots() {
  const catalog = await loadDemoCatalog();
  return [
    {
      id: catalog.catalogVersion,
      moduleCount: catalog.modules.length,
      currency: catalog.currency ?? 'EUR',
      default: catalog.catalogVersion === DEFAULT_CATALOG_SNAPSHOT_ID
    }
  ];
}
