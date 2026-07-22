import {
  ClientResponseSchema,
  createClarifyResponse as createContractClarifyResponse,
  createStubClientResponse
} from '@homecraft/contracts';
import { normalizeLanguage, t } from '../i18n/messages.js';

function summarizeForSpeech(message) {
  const normalized = message.trim().replace(/\s+/g, ' ');
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157)}...`;
}

function buildChangeSummary(plan, message) {
  const operations = plan?.operations ?? [];
  return {
    text: message,
    added: operations
      .filter((operation) => operation.type === 'add_module')
      .map((operation) => operation.sku),
    removed: operations
      .filter((operation) => operation.type === 'remove_module')
      .map((operation) => operation.instanceId),
    moved: operations
      .filter((operation) => operation.type === 'move_module')
      .map((operation) => operation.instanceId)
  };
}

/**
 * Builds validated ClientResponse for API and clients.
 */
export function buildOutput(input) {
  const language = normalizeLanguage(input.request?.language ?? input.language);
  const message = input.message ?? t(language, 'commandProcessed');
  const base = createStubClientResponse(
    {
      requestId: input.request.requestId,
      sessionId: input.request.sessionId,
      projectId: input.request.projectId
    },
    {
      message,
      speech: input.speech ?? summarizeForSpeech(message),
      explanation: input.explanation,
      changeSummary: input.changeSummary ?? buildChangeSummary(input.plan, message),
      view: input.view ?? { kind: '2d_plan', render: 'full' },
      interaction: { expects: 'none' },
      planVersion: input.planVersion ?? 0,
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

export function buildUnknownIntentResponse(request, _context) {
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
    planVersion: 0,
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function buildHelpResponse(request, helpMessage) {
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
    planVersion: 0,
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
