import { assertCompatible } from '../compatibility-engine/assertCompatible.js';
import { buildOutput } from './output-builder.js';
import { runPipeline as runKitchenPipeline } from '../domain-modules/kitchen/pipeline.js';
import { getCachedBOM } from '../pricing-engine/bom-cache.js';
import {
  appendPlanVersion,
  getActiveBranchMeta
} from '../storage/local-storage.js';
import { normalizeLanguage, t } from '../i18n/messages.js';

/**
 * Runs compatibility, kitchen pipeline, BOM, and optional plan-version persistence.
 *
 * @param {{
 *   request: import('zod').infer<typeof import('@homecraft/contracts').ClientRequestSchema>,
 *   context: import('zod').infer<typeof import('@homecraft/contracts').RoomContextSchema>,
 *   plan: import('zod').infer<typeof import('@homecraft/contracts').ConfigurationPlanSchema>,
 *   message: string,
 *   explanation?: string,
 *   persistVersion?: boolean,
 *   existingVersion?: number,
 *   changeSummary?: object,
 *   view?: object
 * }} input
 */
export async function runDownstream({
  request,
  context,
  plan,
  message,
  explanation,
  persistVersion = true,
  existingVersion,
  changeSummary,
  view
}) {
  const language = normalizeLanguage(request.language);
  const compatibility = await assertCompatible(plan, context);
  const scene = await runKitchenPipeline(plan, context);
  const bom = await getCachedBOM(plan, plan.catalogSnapshotId);
  const effectiveMessage = compatibility.valid
    ? message
    : t(language, 'changesRejected', {
        details: compatibility.conflicts.map((conflict) => conflict.message).join(' ')
      });

  let versionEntry = null;
  if (persistVersion && existingVersion === undefined && compatibility.valid) {
    versionEntry = await appendPlanVersion(
      request.sessionId,
      request.projectId,
      plan,
      request.requestId,
      request.expectedVersion
    );
  }

  const budgetExplanation =
    context.budgetEur !== undefined && bom.totalEur > context.budgetEur
      ? t(language, 'budgetExceeded', {
          over: bom.totalEur - context.budgetEur
        })
      : undefined;

  const branchMeta = await getActiveBranchMeta(
    request.sessionId,
    request.projectId
  );

  return buildOutput({
    request,
    plan,
    scene,
    bom,
    compatibility,
    roomShape: context.roomShape,
    budgetEur: context.budgetEur ?? null,
    message: effectiveMessage,
    explanation: budgetExplanation
      ? [explanation, budgetExplanation].filter(Boolean).join(' ')
      : explanation,
    changeSummary: compatibility.valid
      ? changeSummary
      : {
          text: effectiveMessage,
          added: [],
          removed: [],
          moved: []
        },
    view,
    planVersion: existingVersion ?? versionEntry?.version ?? context.planVersion ?? 0,
    branchId: branchMeta.branchId,
    branchName: branchMeta.branchName
  });
}
