import { BOMSchema } from '@homecraft/contracts';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';

/** Pure BOM calculator — never rejects plans for budget. */
export async function calculateBOM(plan, catalogSnapshotId) {
  const modules = await materializePlan(plan);
  const grouped = new Map();

  for (const module of modules) {
    const finish = module.finishes.find((item) => item.id === module.finishId);
    const unitPriceRub = module.priceRub + (finish?.priceDeltaRub ?? 0);
    const key = `${module.sku}:${module.finishId ?? ''}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity += 1;
      current.lineTotalRub = current.quantity * current.unitPriceRub;
    } else {
      grouped.set(key, {
        sku: module.sku,
        name: module.name,
        quantity: 1,
        unitPriceRub,
        lineTotalRub: unitPriceRub,
        finishId: module.finishId
      });
    }
  }

  const lines = [...grouped.values()];
  const subtotalRub = lines.reduce((sum, line) => sum + line.lineTotalRub, 0);
  const vatRub = Math.round((subtotalRub * 20) / 120);
  return BOMSchema.parse({
    catalogSnapshotId,
    lines,
    subtotalRub,
    vatRub,
    totalRub: subtotalRub,
    calculatedAt: new Date().toISOString()
  });
}
