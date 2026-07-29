import { detectIntent } from './intent-detector.js';
import { generatePlan } from './configuration-plan-generator.js';
import {
  retrieve,
  retrievePlatformRules
} from './catalog-rag-retriever.js';
import { runtimeConfig } from '../config/runtime.js';

/**
 * AI pipeline: intent → retrieve → plan.
 * Retrieved catalog/rules feed generatePlan (no unused prompt path).
 */
export async function runAiPipeline(request, context) {
  const dialogText = request.command;
  const intent = await detectIntent(dialogText, request.language);

  const [candidates, platformRules] = await Promise.all([
    retrieve(dialogText, context.catalogSnapshotId, runtimeConfig.kbTopK),
    retrievePlatformRules(dialogText, 3)
  ]);
  const { plan, outcome } = await generatePlan({
    intent,
    context,
    dialogText,
    candidates,
    platformRules
  });

  return { intent, plan, outcome };
}
