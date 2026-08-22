import { normalizeLanguage, t, getLocalizedCommandList } from '../i18n/messages.js';
import {
  DEFAULT_CATALOG_SNAPSHOT_ID,
  getCatalogSnapshot
} from '../knowledge-base/catalog-store.js';
import { isCatalogPhrase } from './journey-table.js';
import { registry } from '@homecraft/contracts';

/**
 * @param {unknown} language
 */
export function getCommandsMessage(language = 'en') {
  return getLocalizedCommandList(language);
}

/**
 * @param {string} [productType]
 */
function snapshotIdFor(productType) {
  try {
    return registry.get(productType).catalogSnapshotId ?? DEFAULT_CATALOG_SNAPSHOT_ID;
  } catch {
    return DEFAULT_CATALOG_SNAPSHOT_ID;
  }
}

/**
 * @param {unknown} language
 * @param {string} [catalogSnapshotId]
 * @param {string} [productType]
 */
export async function getCatalogMessage(
  language = 'en',
  catalogSnapshotId,
  productType = 'kitchen'
) {
  const lang = normalizeLanguage(language);
  const snapshotId = catalogSnapshotId ?? snapshotIdFor(productType);
  try {
    const catalog = await getCatalogSnapshot(snapshotId, productType);
    const lines = catalog.modules.map((module) => {
      const dims = `${module.dimensions.widthMm}×${module.dimensions.heightMm}×${module.dimensions.depthMm}`;
      return `${module.sku}  ${dims}  €${module.priceEur}`;
    });
    return [
      t(lang, 'catalogIntro', {
        version: catalog.catalogVersion,
        count: catalog.modules.length
      }),
      ...lines
    ].join('\n');
  } catch {
    return t(lang, 'catalogUnavailable');
  }
}

/**
 * @param {string} command
 * @param {unknown} language
 * @param {string} [catalogSnapshotId]
 * @param {string} [productType]
 */
export async function getHelpOrCatalogMessage(
  command,
  language = 'en',
  catalogSnapshotId,
  productType = 'kitchen'
) {
  if (isCatalogPhrase(command)) {
    return getCatalogMessage(language, catalogSnapshotId, productType);
  }
  return getCommandsMessage(language);
}
