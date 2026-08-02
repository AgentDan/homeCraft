import {
  ClientResponseSchema,
  createClarifyResponse as createContractClarifyResponse,
  createStubClientResponse
} from '@homecraft/contracts';
import { normalizeLanguage, t } from '../i18n/messages.js';
import {
  buildDecisionReport,
  explainFromReport
} from './decision-report.js';
import { resolveSkuThumbnailUrl } from './gltf-thumbnail.js';

const OPERATION_ADD_MODULE = 'add_module';
const OPERATION_REMOVE_MODULE = 'remove_module';
const OPERATION_MOVE_MODULE = 'move_module';
const OPERATION_REPLACE_MODULE = 'replace_module';

function summarizeForSpeech(message) {
  const normalized = message.trim().replace(/\s+/g, ' ');
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157)}...`;
}

/**
 * Builds a change summary from plan operations.
 *
 * Dialog path (sinceOperationCount set): only the delta ops, and replace_module
 * contributes to both added (sku) and removed (instanceId).
 * Fallback path (no sinceOperationCount): full plan, add/remove/move only —
 * the historical buildOutput default when callers omit changeSummary.
 *
 * @param {{ operations?: Array<{ type: string, sku?: string, instanceId?: string }> } | null | undefined} plan
 * @param {string} message
 * @param {{ sinceOperationCount?: number }} [options]
 */
export function buildChangeSummary(plan, message, options = {}) {
  const allOperations = plan?.operations ?? [];
  const hasDeltaIndex = typeof options.sinceOperationCount === 'number';
  const operations = hasDeltaIndex
    ? allOperations.slice(options.sinceOperationCount)
    : allOperations;

  if (hasDeltaIndex) {
    return {
      text: message,
      added: operations
        .filter(
          (operation) =>
            operation.type === OPERATION_ADD_MODULE ||
            operation.type === OPERATION_REPLACE_MODULE
        )
        .map((operation) => operation.sku),
      removed: operations
        .filter(
          (operation) =>
            operation.type === OPERATION_REMOVE_MODULE ||
            operation.type === OPERATION_REPLACE_MODULE
        )
        .map((operation) => operation.instanceId),
      moved: operations
        .filter((operation) => operation.type === OPERATION_MOVE_MODULE)
        .map((operation) => operation.instanceId)
    };
  }

  return {
    text: message,
    added: operations
      .filter((operation) => operation.type === OPERATION_ADD_MODULE)
      .map((operation) => operation.sku),
    removed: operations
      .filter((operation) => operation.type === OPERATION_REMOVE_MODULE)
      .map((operation) => operation.instanceId),
    moved: operations
      .filter((operation) => operation.type === OPERATION_MOVE_MODULE)
      .map((operation) => operation.instanceId)
  };
}

/**
 * Resolve grounded explanation from intent/BOM/policy fields.
 * @param {{
 *   intentKind?: string,
 *   bom?: { lines?: unknown[], subtotalEur?: number, totalEur?: number } | null,
 *   budgetEur?: number | null,
 *   compatibility?: { valid?: boolean, conflicts?: unknown[] } | null,
 *   policy?: {
 *     decision: 'auto_apply' | 'ask_user' | 'none',
 *     winnerSku?: string,
 *     score?: number,
 *     gap?: number,
 *     policyVersion?: string
 *   } | null,
 *   explanation?: string
 * }} input
 * @param {string} language
 * @param {string} message
 */
function resolveExplanation(input, language, message) {
  if (input.intentKind || input.bom || input.compatibility || input.policy) {
    const report = buildDecisionReport({
      intentKind: input.intentKind,
      message,
      bom: input.bom,
      budgetEur: input.budgetEur,
      compatibility: input.compatibility,
      policy: input.policy
    });
    return explainFromReport(report, language);
  }
  return input.explanation;
}

/**
 * Builds validated ClientResponse for API and clients.
 */
export function buildOutput(input) {
  const language = normalizeLanguage(input.request?.language ?? input.language);
  const message = input.message ?? t(language, 'commandProcessed');
  const explanation = resolveExplanation(input, language, message);
  const speechSource = explanation || message;
  const base = createStubClientResponse(
    {
      requestId: input.request.requestId,
      sessionId: input.request.sessionId,
      projectId: input.request.projectId
    },
    {
      message,
      speech: input.speech ?? summarizeForSpeech(speechSource),
      explanation,
      changeSummary: input.changeSummary ?? buildChangeSummary(input.plan, message),
      view: input.view ?? { kind: '2d_plan', render: 'full' },
      interaction: { expects: 'none' },
      planVersion: input.planVersion ?? 0,
      branchId: input.branchId,
      branchName: input.branchName,
      plan: input.plan,
      sceneResult: input.scene,
      roomShape: input.roomShape ?? null,
      bom: input.bom,
      budgetEur: input.budgetEur ?? null,
      compatibility: input.compatibility,
      responseType: input.compatibility.valid ? 'scene' : 'conflict'
    }
  );

  return ClientResponseSchema.parse({
    ...base,
    requestId: input.request.requestId,
    sessionId: input.request.sessionId,
    projectId: input.request.projectId
  });
}

/**
 * Builds an `options` response containing priced candidate plans after a conflict
 * when policy confidence is too low to auto-apply.
 */
export function buildCandidatesResponse(input) {
  const language = normalizeLanguage(input.language ?? input.request?.language);
  const rejectDetails = input.compatibility.conflicts
    .map((conflict) => conflict.message)
    .join(' ');
  const ranked = input.scored ?? [];
  const intro = t(language, 'candidatesNearTie', {
    count: ranked.length,
    details: rejectDetails,
    gap: input.gap ?? 0
  });
  const explanation = resolveExplanation(
    {
      intentKind: input.intentKind,
      bom: input.bom,
      budgetEur: input.budgetEur,
      compatibility: input.compatibility,
      policy: {
        decision: 'ask_user',
        gap: input.gap ?? 0,
        policyVersion: input.policyVersion
      }
    },
    language,
    intro
  );

  const options = ranked.map((entry, index) => {
    const sku = entry.candidate.replacedWithSku;
    const thumbnailUrl = resolveSkuThumbnailUrl(sku);
    return {
      id: `candidate-${index + 1}`,
      label: t(language, 'candidateOptionScored', {
        index: index + 1,
        sku,
        instanceId: entry.candidate.replacedInstanceId,
        totalEur: entry.candidate.bom.totalEur,
        score: entry.score
      }),
      ...(thumbnailUrl ? { thumbnailUrl } : {})
    };
  });

  return ClientResponseSchema.parse({
    requestId: input.request.requestId,
    sessionId: input.request.sessionId,
    projectId: input.request.projectId,
    status: 'needs_input',
    responseType: 'options',
    message: intro,
    speech: summarizeForSpeech(explanation || intro),
    explanation,
    changeSummary: { text: intro, added: [], removed: [], moved: [] },
    view: { kind: '3d_scene', render: 'full' },
    interaction: {
      expects: 'choice',
      prompt: intro,
      options
    },
    planVersion: input.planVersion ?? 0,
    branchId: input.branchId,
    branchName: input.branchName,
    plan: input.plan,
    sceneResult: input.scene ?? null,
    roomShape: input.roomShape ?? null,
    bom: input.bom ?? null,
    budgetEur: input.budgetEur ?? null,
    compatibility: input.compatibility,
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function buildUnknownIntentResponse(request, _context, planVersion = 0) {
  const language = normalizeLanguage(request.language);
  const prompt = t(language, 'unknownIntent');
  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'needs_input',
    responseType: 'unknown_intent',
    message: prompt,
    speech: prompt,
    explanation: t(language, 'unknownExplanation'),
    interaction: { expects: 'free_text', prompt },
    planVersion,
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function buildHelpResponse(request, helpMessage, planVersion = 0) {
  const language = normalizeLanguage(request.language);
  const message = helpMessage ?? t(language, 'helpFallback');
  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'ok',
    responseType: 'help',
    message,
    speech: message,
    explanation: t(language, 'helpExplanation'),
    interaction: { expects: 'none' },
    planVersion,
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function buildClarifyResponse(request, prompt, planVersion = 0) {
  return createContractClarifyResponse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    prompt,
    planVersion
  });
}
