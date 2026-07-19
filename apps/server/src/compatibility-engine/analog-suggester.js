/**
 * Analog suggester: proposes catalog SKUs that could resolve a conflict.
 *
 * Suggestions stay within the same category (a sink stays a sink) and are ranked
 * by how well they address the specific conflict kind — smaller units for spatial
 * conflicts, fewer utility needs for utility conflicts.
 */

const MAX_SUGGESTIONS = 3;

const SPATIAL_KINDS = new Set([
  'dimension_exceeded',
  'overlap',
  'clearance_violation'
]);

/**
 * @param {import('./rules/types.js').PlacedModule | null | undefined} module
 * @param {{ modules: Array<{ sku: string, category: string, dimensions: { widthMm: number }, utilities?: string[] }> }} catalog
 * @param {import('./rules/types.js').ConflictKind} conflictKind
 * @returns {string[]}
 */
export function suggestAnalogs(module, catalog, conflictKind) {
  if (!module) return [];

  const sameCategory = catalog.modules.filter(
    (candidate) => candidate.category === module.category && candidate.sku !== module.sku
  );

  let ranked;
  if (SPATIAL_KINDS.has(conflictKind)) {
    ranked = sameCategory
      .filter((candidate) => candidate.dimensions.widthMm < module.dimensions.widthMm)
      .sort((a, b) => b.dimensions.widthMm - a.dimensions.widthMm);
  } else if (conflictKind === 'utility_conflict') {
    ranked = [...sameCategory].sort(
      (a, b) =>
        (a.utilities?.length ?? 0) - (b.utilities?.length ?? 0)
        || widthGap(a, module) - widthGap(b, module)
    );
  } else {
    ranked = [...sameCategory].sort((a, b) => widthGap(a, module) - widthGap(b, module));
  }

  return ranked.slice(0, MAX_SUGGESTIONS).map((candidate) => candidate.sku);
}

/**
 * @param {{ dimensions: { widthMm: number } }} candidate
 * @param {{ dimensions: { widthMm: number } }} module
 */
function widthGap(candidate, module) {
  return Math.abs(candidate.dimensions.widthMm - module.dimensions.widthMm);
}
