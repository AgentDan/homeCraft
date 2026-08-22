import { createHash } from 'node:crypto';
import {
  ConfigurationPlanSchema,
  createEmptyPlan,
  registry
} from '@homecraft/contracts';
import { normalizeLanguage, t } from '../i18n/messages.js';

function stablePlanId(projectId, operations) {
  const digest = createHash('sha256')
    .update(JSON.stringify(operations))
    .digest('hex')
    .slice(0, 12);
  return `plan-${projectId}-${digest}`;
}

function createPlan(input, operations) {
  const projectId = input.context.projectId;
  return ConfigurationPlanSchema.parse({
    ...createEmptyPlan({
      planId: stablePlanId(projectId, operations),
      projectId,
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

function nextPosition(operations, candidates, defaultWidthMm = 600) {
  const widths = new Map(candidates.map((module) => [module.sku, module.dimensions.widthMm]));
  return operations
    .filter((operation) => operation.type === 'add_module')
    .reduce(
      (rightEdge, operation) =>
        Math.max(rightEdge, operation.position.x + (widths.get(operation.sku) ?? defaultWidthMm)),
      0
    );
}

/**
 * Generates a deterministic ConfigurationPlan from an intent and catalog candidates.
 */
export async function generatePlan(input) {
  const operations = structuredClone(input.context.planOperations ?? []);
  const slots = input.intent.slots ?? {};
  const language = normalizeLanguage(input.intent.language);
  const productType = input.context.productType ?? 'kitchen';
  const manifest = registry.get(productType);

  if (input.intent.kind === 'add_module') {
    const starterOperations = manifest.starterOperations ?? [];
    if (slots.layout === 'starter_kitchen' && starterOperations.length > 0) {
      operations.push(.../** @type {typeof operations} */ (starterOperations));
      return {
        plan: createPlan(input, operations),
        outcome: { kind: 'applied', addedCount: starterOperations.length }
      };
    }

    const candidate = chooseCandidate(input.candidates, slots);
    if (!candidate) {
      return {
        plan: createPlan(input, operations),
        outcome: {
          kind: 'clarify',
          prompt: t(language, 'clarifyAddModule')
        }
      };
    }
    operations.push({
      type: 'add_module',
      sku: candidate.sku,
      position: {
        x: nextPosition(
          operations,
          input.candidates,
          manifest.defaultModuleWidthMm ?? 600
        ),
        y: candidate.mounting === 'wall' ? (manifest.wallMountHeightMm ?? 0) : 0,
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
        outcome: {
          kind: 'clarify',
          prompt: t(language, 'clarifyNothingToRemove')
        }
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
          prompt: t(language, 'clarifyReplace')
        }
      };
    }
    if (!active.some((module) => module.instanceId === target)) {
      return {
        plan: createPlan(input, operations),
        outcome: {
          kind: 'clarify',
          prompt: t(language, 'clarifyMissingModule', { target })
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
          prompt: t(language, 'clarifyFinish')
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
