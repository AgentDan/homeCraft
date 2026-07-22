import { getCatalogSnapshot } from '../../knowledge-base/catalog-store.js';

export async function materializePlan(plan) {
  const catalog = await getCatalogSnapshot(plan.catalogSnapshotId);
  const catalogBySku = new Map(catalog.modules.map((module) => [module.sku, module]));
  const modules = new Map();
  let addIndex = 0;

  for (const operation of plan.operations) {
    if (operation.type === 'add_module') {
      addIndex += 1;
      const catalogModule = catalogBySku.get(operation.sku);
      if (!catalogModule) {
        throw new Error(`Unknown catalog SKU "${operation.sku}".`);
      }
      const instanceId = `module-${addIndex}`;
      modules.set(instanceId, {
        instanceId,
        ...structuredClone(catalogModule),
        position: structuredClone(operation.position),
        rotationY: operation.rotationY,
        finishId: catalogModule.finishes[0]?.id
      });
      continue;
    }

    const module = modules.get(operation.instanceId);
    if (!module) {
      continue;
    }
    if (operation.type === 'remove_module') {
      modules.delete(operation.instanceId);
    } else if (operation.type === 'move_module') {
      module.position = structuredClone(operation.position);
      module.rotationY = operation.rotationY ?? module.rotationY;
    } else if (operation.type === 'change_finish') {
      const finishExists = module.finishes.some(
        (finish) => finish.id === operation.finishId
      );
      if (!finishExists) {
        throw new Error(
          `Finish "${operation.finishId}" is unavailable for "${module.sku}".`
        );
      }
      module.finishId = operation.finishId;
    } else if (operation.type === 'replace_module') {
      const catalogModule = catalogBySku.get(operation.sku);
      if (!catalogModule) {
        throw new Error(`Unknown catalog SKU "${operation.sku}".`);
      }
      const keepFinish = catalogModule.finishes.some(
        (finish) => finish.id === module.finishId
      );
      modules.set(operation.instanceId, {
        instanceId: operation.instanceId,
        ...structuredClone(catalogModule),
        position: structuredClone(module.position),
        rotationY: module.rotationY,
        finishId: keepFinish
          ? module.finishId
          : catalogModule.finishes[0]?.id
      });
    }
  }

  return [...modules.values()];
}
