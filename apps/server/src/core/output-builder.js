import {
  ClientResponseSchema,
  createClarifyResponse as createContractClarifyResponse,
  createStubClientResponse
} from '@homecraft/contracts';

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
  const message = input.message ?? 'Command processed.';
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
  const prompt = 'The command was not understood. Please rephrase it.';
  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'needs_input',
    responseType: 'unknown_intent',
    message: prompt,
    speech: prompt,
    explanation: 'Intent detection returned unknown.',
    interaction: { expects: 'free_text', prompt },
    planVersion: 0,
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function buildHelpResponse(request, helpMessage) {
  const message = helpMessage ?? 'Describe the kitchen by text or voice.';
  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'ok',
    responseType: 'help',
    message,
    speech: message,
    explanation: 'Available commands were provided by the Help service.',
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
