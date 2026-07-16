import { runAiPipeline } from '../ai-services/pipeline.js';
import { assertCompatible } from '../compatibility-engine/assertCompatible.js';
import { buildHelpResponse, buildOutput, buildUnknownIntentResponse } from './output-builder.js';
import {
  appendDialogTurn,
  buildRoomContext
} from './room-context-builder.js';
import { runPipeline as runKitchenPipeline } from '../domain-modules/kitchen/pipeline.js';
import { calculateBOM } from '../pricing-engine/calculateBOM.js';
import { recordCommandRequest } from '../storage/local-storage.js';

/**
 * Single entry for MODE A (dialog) and MODE B (editor).
 * Both converge to ConfigurationPlan and the same downstream pipeline.
 */
export async function route(request) {
  await recordCommandRequest(request);

  let context = await buildRoomContext(undefined, request.projectId, request.sessionId);
  if (request.catalogSnapshotId) {
    context = { ...context, catalogSnapshotId: request.catalogSnapshotId };
  }

  if (request.inputMode === 'dialog') {
    const text = request.command ?? '';
    context = appendDialogTurn(context, 'user', text);

    const { intent, plan } = await runAiPipeline(request, context);

    if (intent.kind === 'help') {
      const help = buildHelpResponse(request);
      return { response: help, statusCode: 200 };
    }

    if (intent.kind === 'unknown') {
      const unknown = buildUnknownIntentResponse(request, context);
      return { response: unknown, statusCode: 200 };
    }

    const compatibility = await assertCompatible(plan, context);
    const scene = await runKitchenPipeline(plan, context);
    const bom = await calculateBOM(plan, plan.catalogSnapshotId);

    const response = buildOutput({
      request,
      plan,
      scene,
      bom,
      compatibility,
      message: 'Dialog command processed (step0).',
      explanation: `Intent: ${intent.kind}`
    });

    return { response, statusCode: 200 };
  }

  // MODE B — editor
  const { plan } = await runAiPipeline(request, context);

  const compatibility = await assertCompatible(plan, context);
  const scene = await runKitchenPipeline(plan, context);
  const bom = await calculateBOM(plan, plan.catalogSnapshotId);

  const response = buildOutput({
    request,
    plan,
    scene,
    bom,
    compatibility,
    message: 'Editor operations applied (step0).',
    explanation: 'MODE B uses the same pipeline as MODE A.'
  });

  return { response, statusCode: 200 };
}
