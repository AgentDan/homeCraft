import { registry } from '@homecraft/contracts';
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
 *   intentKind?: string,
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
  intentKind,
  persistVersion = true,
  existingVersion,
  changeSummary,
  view
}) {
  const language = normalizeLanguage(request.language);
  const manifest = registry.get(plan.productType ?? 'kitchen');
  const compatibility = await manifest.assertCompatible(plan, context);
  const scene = await runKitchenPipeline(plan, context);
  const bom = await getCachedBOM(plan, plan.catalogSnapshotId);
  if (!compatibility.valid) {
    const candidates = await generateCandidates({
      plan,
      compatibility,
      context,
      compatibilityRules: manifest.compatibilityRules
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
        const appliedCompat = await manifest.assertCompatible(appliedPlan, context);
        const appliedMessage = t(language, 'policyApplied', {
          sku: winner.candidate.replacedWithSku,
          instanceId: winner.candidate.replacedInstanceId,
          totalEur: appliedBom.totalEur
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
          intentKind,
          policy: {
            decision: 'auto_apply',
            winnerSku: winner.candidate.replacedWithSku,
            score: winner.score,
            gap: decision.gap,
            policyVersion: decision.policy.version
          },
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
        intentKind,
        roomShape: context.roomShape,
        budgetEur: context.budgetEur ?? null,
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
      intentKind,
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
    intentKind,
    changeSummary,
    view,
    planVersion: existingVersion ?? versionEntry?.version ?? context.planVersion ?? 0,
    branchId: branchMeta.branchId,
    branchName: branchMeta.branchName
  });
}
