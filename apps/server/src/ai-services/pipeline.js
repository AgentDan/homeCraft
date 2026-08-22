import { detectIntent } from './intent-detector.js';
import { generatePlan } from './configuration-plan-generator.js';
import {
  retrieve,
  retrievePlatformRules
} from './catalog-rag-retriever.js';
import { runtimeConfig } from '../config/runtime.js';
import { registry } from '@homecraft/contracts';

/**
 * AI pipeline: intent → retrieve → plan.
 * Retrieved catalog/rules feed generatePlan (no unused prompt path).
 */
export async function runAiPipeline(request, context) {
  const dialogText = request.command;
  const productType = context.productType ?? 'kitchen';
  const manifest = registry.get(productType);
  const intent = await detectIntent(dialogText, request.language, { productType });

  const [candidates, platformRules] = await Promise.all([
    retrieve(dialogText, context.catalogSnapshotId, runtimeConfig.kbTopK, {
      stopWords: manifest.ragStopWords,
      fallbackSku: manifest.ragFallbackSku
    }, productType),
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
