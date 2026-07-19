import {
  DEFAULT_CATALOG_SNAPSHOT_ID,
  getCatalogSnapshot
} from '../knowledge-base/catalog-store.js';

/** Returns an immutable catalog snapshot for a project session. */
export async function createCatalogSnapshot(
  catalogId = DEFAULT_CATALOG_SNAPSHOT_ID
) {
  return getCatalogSnapshot(catalogId);
}

export async function getSnapshotById(snapshotId) {
  return getCatalogSnapshot(snapshotId);
}
