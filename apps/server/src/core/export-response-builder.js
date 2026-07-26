import { ClientResponseSchema } from '@homecraft/contracts';
import { getCachedBOM } from '../pricing-engine/bom-cache.js';
import { createOrGetExport } from '../export/export-store.js';
import { t } from '../i18n/messages.js';

/**
 * Builds the ClientResponse for a successful export_project intent.
 * Kept outside intent-handlers so the handler file stays within the size budget.
 *
 * @param {import('./intent-handlers/types.js').IntentHandlerInput} input
 * @param {number} planVersion
 */
export async function buildExportClientResponse(input, planVersion) {
  const { request, context, plan, language } = input;
  const bom = await getCachedBOM(plan, plan.catalogSnapshotId);
  const exported = await createOrGetExport({
    projectId: request.projectId,
    planVersion,
    catalogSnapshotId: plan.catalogSnapshotId,
    requestId: request.requestId,
    plan,
    bom
  });
  const message = t(language, 'exportReady', {
    version: planVersion,
    catalog: plan.catalogSnapshotId
  });

  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'ok',
    responseType: 'export',
    message,
    speech: message,
    explanation: t(language, 'exportExplanation', {
      sha: exported.record.contentSha256.slice(0, 12),
      reused: exported.reused ? 'yes' : 'no'
    }),
    interaction: { expects: 'none' },
    planVersion,
    plan,
    bom,
    budgetEur: context.budgetEur ?? null,
    compatibility: null,
    downloadUrl: exported.downloadUrl,
    errors: [],
    createdAt: new Date().toISOString()
  });
}
