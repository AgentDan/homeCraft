import { assertCompatible } from '../compatibility-engine/assertCompatible.js';
import { generateCandidates } from '../compatibility-engine/candidate-generator.js';
import { decideCandidates } from '../policy/decide-candidates.js';
import { buildOutput, buildCandidatesResponse } from './output-builder.js';
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
  if (!compatibility.valid) {
    const candidates = await generateCandidates({
      plan,
      compatibility,
      context
    });
    const branchMeta = await getActiveBranchMeta(
      request.sessionId,
      request.projectId
    );
    if (candidates.length > 0) {
      const decision = await decideCandidates(candidates, {
        catalogSnapshotId: plan.catalogSnapshotId,
        rejectedPlan: plan
      });

      if (decision.decision === 'auto_apply' && decision.winner) {
        const winner = decision.winner;
        const appliedPlan = winner.candidate.plan;
        const appliedScene = await runKitchenPipeline(appliedPlan, context);
        const appliedBom = winner.candidate.bom;
        /** @type {{ version: number } | null} */
        let versionEntry = null;
        if (persistVersion && existingVersion === undefined) {
          versionEntry = await appendPlanVersion(
            request.sessionId,
            request.projectId,
            appliedPlan,
            request.requestId,
            request.expectedVersion
          );
        }
        const appliedCompat = await assertCompatible(appliedPlan, context);
        const appliedMessage = t(language, 'policyApplied', {
          sku: winner.candidate.replacedWithSku,
          instanceId: winner.candidate.replacedInstanceId,
          totalEur: appliedBom.totalEur
        });
        const policyNote = t(language, 'policyExplanation', {
          score: winner.score,
          gap: decision.gap,
          policyVersion: decision.policy.version
        });
        return buildOutput({
          request,
          plan: appliedPlan,
          scene: appliedScene,
          bom: appliedBom,
          compatibility: appliedCompat,
          roomShape: context.roomShape,
          budgetEur: context.budgetEur ?? null,
          message: appliedMessage,
          explanation: [explanation, policyNote].filter(Boolean).join(' '),
          changeSummary: {
            text: appliedMessage,
            added: [winner.candidate.replacedWithSku],
            removed: [winner.candidate.replacedInstanceId],
            moved: []
          },
          view: view ?? { kind: '3d_scene', render: 'full' },
          planVersion:
            existingVersion
            ?? versionEntry?.version
            ?? context.planVersion
            ?? 0,
          branchId: branchMeta.branchId,
          branchName: branchMeta.branchName
        });
      }

      return buildCandidatesResponse({
        request,
        plan,
        scene,
        bom,
        compatibility,
        scored: decision.ranked,
        gap: decision.gap,
        policyVersion: decision.policy.version,
        roomShape: context.roomShape,
        budgetEur: context.budgetEur ?? null,
        explanation,
        planVersion: existingVersion ?? context.planVersion ?? 0,
        branchId: branchMeta.branchId,
        branchName: branchMeta.branchName,
        language
      });
    }
    const rejectMessage = t(language, 'changesRejected', {
      details: compatibility.conflicts
        .map((conflict) => conflict.message)
        .join(' ')
    });
    return buildOutput({
      request,
      plan,
      scene,
      bom,
      compatibility,
      roomShape: context.roomShape,
      budgetEur: context.budgetEur ?? null,
      message: rejectMessage,
      explanation,
      changeSummary: {
        text: rejectMessage,
        added: [],
        removed: [],
        moved: []
      },
      view,
      planVersion: existingVersion ?? context.planVersion ?? 0,
      branchId: branchMeta.branchId,
      branchName: branchMeta.branchName
    });
  }

  /** @type {{ version: number } | null} */
  let versionEntry = null;
  if (persistVersion && existingVersion === undefined) {
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
    message,
    explanation: budgetExplanation
      ? [explanation, budgetExplanation].filter(Boolean).join(' ')
      : explanation,
    changeSummary,
    view,
    planVersion: existingVersion ?? versionEntry?.version ?? context.planVersion ?? 0,
    branchId: branchMeta.branchId,
    branchName: branchMeta.branchName
  });
}
