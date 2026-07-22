import {
  ConfigurationPlanSchema,
  createEmptyPlan
} from '@homecraft/contracts';

function createPlan(input, operations) {
  return ConfigurationPlanSchema.parse({
    ...createEmptyPlan({
      planId: `plan-${Date.now()}`,
      projectId: input.context.projectId,
      catalogSnapshotId: input.context.catalogSnapshotId
    }),
    operations
  });
}

function chooseCandidate(candidates, slots) {
  if (slots.sku) {
    return candidates.find((module) => module.sku === slots.sku) ?? null;
  }
  const filtered = candidates.filter((module) =>
    (!slots.category || module.category === slots.category)
    && (!slots.widthMm || module.dimensions.widthMm === slots.widthMm)
  );
  return filtered[0] ?? candidates[0] ?? null;
}

function activeInstances(operations) {
  const modules = new Map();
  let addIndex = 0;
  for (const operation of operations) {
    if (operation.type === 'add_module') {
      addIndex += 1;
      modules.set(`module-${addIndex}`, {
        instanceId: `module-${addIndex}`,
        sku: operation.sku
      });
    } else if (operation.type === 'remove_module') {
      modules.delete(operation.instanceId);
    } else if (operation.type === 'replace_module') {
      const existing = modules.get(operation.instanceId);
      if (existing) {
        modules.set(operation.instanceId, {
          ...existing,
          sku: operation.sku
        });
      }
    }
  }
  return [...modules.values()];
}

function nextPosition(operations, candidates) {
  const widths = new Map(candidates.map((module) => [module.sku, module.dimensions.widthMm]));
  return operations
    .filter((operation) => operation.type === 'add_module')
    .reduce(
      (rightEdge, operation) =>
        Math.max(rightEdge, operation.position.x + (widths.get(operation.sku) ?? 600)),
      0
    );
}

function starterKitchenOperations() {
  return [
    {
      type: 'add_module',
      sku: 'SINK-600',
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0
    },
    {
      type: 'add_module',
      sku: 'BASE-600',
      position: { x: 600, y: 0, z: 0 },
      rotationY: 0
    },
    {
      type: 'add_module',
      sku: 'DRAWER-400',
      position: { x: 1200, y: 0, z: 0 },
      rotationY: 0
    },
    {
      type: 'add_module',
      sku: 'WALL-600',
      position: { x: 600, y: 1400, z: 0 },
      rotationY: 0
    }
  ];
}

/**
 * Generates a deterministic ConfigurationPlan from an intent and catalog candidates.
 */
export async function generatePlan(input) {
  const operations = structuredClone(input.context.planOperations ?? []);
  const slots = input.intent.slots ?? {};

  if (input.intent.kind === 'add_module') {
    if (slots.layout === 'starter_kitchen') {
      operations.push(...starterKitchenOperations());
      return {
        plan: createPlan(input, operations),
        outcome: { kind: 'applied', addedCount: 4 }
      };
    }

    const candidate = chooseCandidate(input.candidates, slots);
    if (!candidate) {
      return {
        plan: createPlan(input, operations),
        outcome: {
          kind: 'clarify',
          prompt: 'Which module should be added? Enter a type and width, for example "base cabinet 600".'
        }
      };
    }
    operations.push({
      type: 'add_module',
      sku: candidate.sku,
      position: {
        x: nextPosition(operations, input.candidates),
        y: candidate.mounting === 'wall' ? 1400 : 0,
        z: 0
      },
      rotationY: 0
    });
    return {
      plan: createPlan(input, operations),
      outcome: { kind: 'applied', sku: candidate.sku, addedCount: 1 }
    };
  }

  if (input.intent.kind === 'remove_module') {
    const active = activeInstances(operations);
    const target = slots.instanceId ?? active.at(-1)?.instanceId;
    if (!target) {
      return {
        plan: createPlan(input, operations),
        outcome: { kind: 'clarify', prompt: 'The project has no module that can be removed.' }
      };
    }
    operations.push({ type: 'remove_module', instanceId: target });
    return {
      plan: createPlan(input, operations),
      outcome: { kind: 'applied', instanceId: target }
    };
  }

  if (input.intent.kind === 'replace_module') {
    const active = activeInstances(operations);
    const target = slots.instanceId ?? active.at(-1)?.instanceId;
    const sku = slots.sku
      ?? chooseCandidate(input.candidates, slots)?.sku
      ?? null;
    if (!target || !sku) {
      return {
        plan: createPlan(input, operations),
        outcome: {
          kind: 'clarify',
          prompt: 'Specify a module and SKU to swap, for example "replace module-1 with BASE-400".'
        }
      };
    }
    if (!active.some((module) => module.instanceId === target)) {
      return {
        plan: createPlan(input, operations),
        outcome: {
          kind: 'clarify',
          prompt: `Module ${target} is not in the project.`
        }
      };
    }
    operations.push({ type: 'replace_module', instanceId: target, sku });
    return {
      plan: createPlan(input, operations),
      outcome: { kind: 'applied', instanceId: target, sku }
    };
  }

  if (input.intent.kind === 'change_finish') {
    const active = activeInstances(operations);
    const target = slots.instanceId ?? active.at(-1)?.instanceId;
    if (!target || !slots.finishId) {
      return {
        plan: createPlan(input, operations),
        outcome: {
          kind: 'clarify',
          prompt: 'Specify a finish and module, for example "change the last cabinet to oak".'
        }
      };
    }
    operations.push({
      type: 'change_finish',
      instanceId: target,
      finishId: slots.finishId
    });
    return {
      plan: createPlan(input, operations),
      outcome: { kind: 'applied', instanceId: target, finishId: slots.finishId }
    };
  }

  return {
    plan: createPlan(input, operations),
    outcome: { kind: 'read_only' }
  };
}
