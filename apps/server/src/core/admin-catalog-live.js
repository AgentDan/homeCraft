/**
 * Live admin catalog fields derived from the per-domain catalog snapshot.
 * Lives in apps/server because catalog I/O cannot live in packages/contracts.
 */
import { getAdminSchemaCatalog, registry } from '@homecraft/contracts';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';

/**
 * @param {string} productType
 * @returns {Promise<{
 *   filterSkus: string[],
 *   filterCategories: string[],
 *   finishIds: string[]
 * }>}
 */
export async function getAdminCatalogFields(productType) {
  const manifest = registry.get(productType);
  const catalog = await getCatalogSnapshot(manifest.catalogSnapshotId, productType);
  return {
    filterSkus: catalog.modules.map((module) => module.sku),
    filterCategories: [...new Set(catalog.modules.map((module) => module.category))],
    finishIds: [
      ...new Set(
        catalog.modules.flatMap((module) => module.finishes.map((finish) => finish.id))
      )
    ]
  };
}

/**
 * Full GET /api/admin/schema-catalog payload: sync schema lists plus live
 * catalog SKUs/categories/finishes. Key names and insertion order match the
 * pre-domain-independence response.
 * @param {string} [productType]
 */
export async function buildAdminSchemaCatalog(productType = 'kitchen') {
  const schema = getAdminSchemaCatalog(productType);
  const { filterSkus, filterCategories, finishIds } =
    await getAdminCatalogFields(productType);
  return {
    journeyStages: schema.journeyStages,
    validationTypes: schema.validationTypes,
    dependsOnOperators: schema.dependsOnOperators,
    knownSlots: schema.knownSlots,
    i18nKeys: schema.i18nKeys,
    dimensionUnits: schema.dimensionUnits,
    enumOptionsBySlot: schema.enumOptionsBySlot,
    conditionKinds: schema.conditionKinds,
    conditionFields: schema.conditionFields,
    conditionOperators: schema.conditionOperators,
    actionTypes: schema.actionTypes,
    filterKeys: schema.filterKeys,
    filterSkus,
    filterCategories,
    filterPreferFrom: schema.filterPreferFrom,
    finishIds,
    dialogueTopics: schema.dialogueTopics
  };
}
