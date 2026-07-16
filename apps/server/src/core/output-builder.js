import { ClientResponseSchema, createStubClientResponse } from '@homecraft/contracts';

/**
 * Builds validated ClientResponse for API and clients.
 */
export function buildOutput(input) {
  const base = createStubClientResponse(
    {
      requestId: input.request.inputMode === 'dialog' ? input.request.requestId : input.request.requestId,
      sessionId: input.request.sessionId,
      projectId: input.request.projectId
    },
    {
      message: input.message ?? 'Command processed.',
      explanation: input.explanation,
      plan: input.plan,
      sceneResult: input.scene,
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
  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'needs_input',
    responseType: 'unknown_intent',
    message: 'Не удалось понять команду. Переформулируйте, пожалуйста.',
    explanation: 'Intent detection returned unknown.',
    errors: [],
    createdAt: new Date().toISOString()
  });
}

export function buildHelpResponse(request) {
  return ClientResponseSchema.parse({
    requestId: request.requestId,
    sessionId: request.sessionId,
    projectId: request.projectId,
    status: 'ok',
    responseType: 'help',
    message: 'HomeCraft step0: опишите кухню текстом или используйте редактор (phase 6).',
    explanation: 'Available intents will expand in phase 1.',
    errors: [],
    createdAt: new Date().toISOString()
  });
}
