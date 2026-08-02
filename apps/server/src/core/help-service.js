import { normalizeLanguage, t, getLocalizedHelpMessage } from '../i18n/messages.js';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';

/**
 * @param {unknown} language
 * @param {string} catalogSnapshotId
 */
export async function getHelpMessage(
  language = 'en',
  catalogSnapshotId = 'kitchen-demo-v1'
) {
  const lang = normalizeLanguage(language);
  const commands = getLocalizedHelpMessage(lang);
  try {
    const catalog = await getCatalogSnapshot(catalogSnapshotId);
    const lines = catalog.modules.map((module) => {
      const dims = `${module.dimensions.widthMm}×${module.dimensions.heightMm}×${module.dimensions.depthMm} mm`;
      const price = `€${module.priceEur}`;
      return `${module.sku} — ${module.name} (${dims}, ${price})`;
    });
    const catalogBlock = [
      t(lang, 'catalogIntro', {
        version: catalog.catalogVersion,
        count: catalog.modules.length
      }),
      lines.join('; ')
    ].join(' ');
    return `${commands} ${catalogBlock}`;
  } catch {
    return `${commands} ${t(lang, 'catalogUnavailable')}`;
  }
}
