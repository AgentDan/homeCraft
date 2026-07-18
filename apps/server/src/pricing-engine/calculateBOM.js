import { BOMSchema } from '@homecraft/contracts';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';

/** Pure BOM calculator — never rejects plans for budget. */
export async function calculateBOM(plan, catalogSnapshotId) {
  const modules = await materializePlan(plan);
  const grouped = new Map();

  for (const module of modules) {
    const finish = module.finishes.find((item) => item.id === module.finishId);
    const unitPriceEur = module.priceEur + (finish?.priceDeltaEur ?? 0);
    const key = `${module.sku}:${module.finishId ?? ''}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity += 1;
      current.lineTotalEur = current.quantity * current.unitPriceEur;
    } else {
      grouped.set(key, {
        sku: module.sku,
        name: module.name,
        quantity: 1,
        unitPriceEur,
        lineTotalEur: unitPriceEur,
        finishId: module.finishId
      });
    }
  }

  const lines = [...grouped.values()];
  const subtotalEur = lines.reduce((sum, line) => sum + line.lineTotalEur, 0);
  const vatEur = Math.round((subtotalEur * 20) / 120);
  return BOMSchema.parse({
    catalogSnapshotId,
    lines,
    subtotalEur,
    vatEur,
    totalEur: subtotalEur,
    calculatedAt: new Date().toISOString()
  });
}
