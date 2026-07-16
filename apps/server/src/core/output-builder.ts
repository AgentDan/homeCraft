import type {
  BOM,
  ClientRequest,
  ClientResponse,
  CompatibilityReport,
  ConfigurationPlan,
  RoomContext,
  SceneResult
} from '@homecraft/contracts';
import { ClientResponseSchema, createStubClientResponse } from '@homecraft/contracts';

export type OutputBuildInput = {
  request: ClientRequest;
  plan: ConfigurationPlan;
  scene: SceneResult;
  bom: BOM;
  compatibility: CompatibilityReport;
  message?: string;
  explanation?: string;
};

/**
 * Builds validated ClientResponse for API and clients.
 */
export function buildOutput(input: OutputBuildInput): ClientResponse {
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

export function buildUnknownIntentResponse(
  request: ClientRequest,
  _context: RoomContext
): ClientResponse {
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

export function buildHelpResponse(request: ClientRequest): ClientResponse {
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
