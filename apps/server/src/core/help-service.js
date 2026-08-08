import { normalizeLanguage, t, getLocalizedCommandList } from '../i18n/messages.js';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';
import { isCatalogPhrase } from './journey-table.js';

/**
 * @param {unknown} language
 */
export function getCommandsMessage(language = 'en') {
  return getLocalizedCommandList(language);
}

/**
 * @param {unknown} language
 * @param {string} catalogSnapshotId
 */
export async function getCatalogMessage(
  language = 'en',
  catalogSnapshotId = 'kitchen-demo-v1'
) {
  const lang = normalizeLanguage(language);
  try {
    const catalog = await getCatalogSnapshot(catalogSnapshotId);
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
 */
export async function getHelpOrCatalogMessage(
  command,
  language = 'en',
  catalogSnapshotId = 'kitchen-demo-v1'
) {
  if (isCatalogPhrase(command)) {
    return getCatalogMessage(language, catalogSnapshotId);
  }
  return getCommandsMessage(language);
}
