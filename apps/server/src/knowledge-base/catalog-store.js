import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeCatalog } from '@homecraft/catalog-schema';
import { registry } from '@homecraft/contracts';

export const DEFAULT_CATALOG_SNAPSHOT_ID = 'kitchen-demo-v1';

const FALLBACK_KITCHEN_CATALOG_PATH = fileURLToPath(
  new URL('./data/source/kitchen-catalog.json', import.meta.url)
);

/** @type {Map<string, ReturnType<typeof normalizeCatalog>>} */
const cachedCatalogs = new Map();

/**
 * @param {string} [productType]
 */
function resolveCatalogPath(productType) {
  try {
    const catalogPath = registry.get(productType).catalogPath;
    if (catalogPath) return catalogPath;
  } catch {
    // Domain not registered — defensive kitchen-file fallback below.
  }
  return FALLBACK_KITCHEN_CATALOG_PATH;
}

/**
 * @param {string} [productType]
 */
export async function loadDemoCatalog(productType = 'kitchen') {
  const cached = cachedCatalogs.get(productType);
  if (cached) {
    return structuredClone(cached);
  }

  const raw = JSON.parse(await readFile(resolveCatalogPath(productType), 'utf8'));
  const catalog = normalizeCatalog(raw);
  cachedCatalogs.set(productType, catalog);
  return structuredClone(catalog);
}

/**
 * @param {string} [snapshotId]
 * @param {string} [productType]
 */
export async function getCatalogSnapshot(
  snapshotId = DEFAULT_CATALOG_SNAPSHOT_ID,
  productType = 'kitchen'
) {
  const catalog = await loadDemoCatalog(productType);
  if (snapshotId !== catalog.catalogVersion) {
    throw new Error(`Catalog snapshot "${snapshotId}" was not found.`);
  }
  return catalog;
}

/**
 * Lists frozen catalog snapshots for one domain (same array-of-one shape as before).
 * An all-domains list would change the response for existing kitchen callers.
 * @param {string} [productType]
 * @returns {Promise<Array<{
 *   id: string,
 *   moduleCount: number,
 *   currency: string,
 *   default: boolean
 * }>>}
 */
export async function listCatalogSnapshots(productType = 'kitchen') {
  const catalog = await loadDemoCatalog(productType);
  let canonicalId = DEFAULT_CATALOG_SNAPSHOT_ID;
  try {
    canonicalId = registry.get(productType).catalogSnapshotId ?? DEFAULT_CATALOG_SNAPSHOT_ID;
  } catch {
    // Unregistered domain: kitchen snapshot remains the default marker.
  }
  return [
    {
      id: catalog.catalogVersion,
      moduleCount: catalog.modules.length,
      currency: catalog.currency ?? 'EUR',
      default: catalog.catalogVersion === canonicalId
    }
  ];
}
