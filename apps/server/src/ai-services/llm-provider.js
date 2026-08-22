import { IntentKindSchema, LanguageSchema, registry } from '@homecraft/contracts';
import { llmIntentConfigured, runtimeConfig } from '../config/runtime.js';

/**
 * @typedef {{ complete: (prompt: string) => Promise<string> }} LlmProvider
 */

/**
 * OpenAI-compatible chat completions provider (fetch).
 * @returns {LlmProvider | null}
 */
export function createHttpLlmProvider() {
  if (!llmIntentConfigured()) return null;

  return {
    async complete(prompt) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        runtimeConfig.llmTimeoutMs
      );
      try {
        /** @type {Record<string, string>} */
        const headers = { 'Content-Type': 'application/json' };
        if (runtimeConfig.llmApiKey) {
          headers.Authorization = `Bearer ${runtimeConfig.llmApiKey}`;
        }
        const response = await fetch(runtimeConfig.llmApiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: runtimeConfig.llmModel,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You extract HomeCraft dialog intents. Reply with a single JSON object only.'
              },
              { role: 'user', content: prompt }
            ]
          }),
          signal: controller.signal
        });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(
            `LLM HTTP ${response.status}: ${body.slice(0, 200)}`
          );
        }
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('LLM response missing message content');
        }
        return content;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

const CORE_INTENT_SLOTS = [
  'widthMm',
  'budgetEur',
  'sku',
  'instanceId',
  'finishId',
  'category',
  'layout',
  'branchName'
];

/**
 * Slot names advertised to the LLM, driven by the active manifest.
 * @param {string} [productType]
 */
function slotHintForManifest(productType = 'kitchen') {
  const names = new Set(CORE_INTENT_SLOTS);
  const manifest = registry.get(productType);
  for (const binding of manifest.siteBindings ?? []) {
    if (typeof binding?.slot === 'string' && binding.slot) {
      names.add(binding.slot);
    }
  }
  const vocabulary = manifest.slotVocabulary ?? {};
  if (vocabulary.skuPrefixes) names.add('sku');
  if (vocabulary.categoryKeywords) names.add('category');
  if (vocabulary.finishKeywords) names.add('finishId');
  if (vocabulary.layoutKeywords) names.add('layout');
  return [...names].join(', ');
}

/**
 * Prompt for intent-only parsing.
 * @param {string} text
 * @param {string | undefined} language
 * @param {string} [productType]
 */
export function buildIntentParsePrompt(text, language, productType = 'kitchen') {
  const kinds = IntentKindSchema.options.join(', ');
  const languages = LanguageSchema.options.join(', ');
  return [
    'Parse the user command into a HomeCraft intent JSON object.',
    `Allowed kind values: ${kinds}.`,
    `Allowed language values: ${languages}.`,
    'For a known intent return:',
    '{ "kind": "<kind>", "confidence": <0..1>, "language": "<en|ru|sr>", "slots": { ... } }',
    'For unknown return:',
    '{ "kind": "unknown", "language": "<en|ru|sr>", "reason": "<short>" }',
    `Slots may include: ${slotHintForManifest(productType)}.`,
    'Do not invent SKUs or instanceIds. Omit a slot when unsure.',
    `Language hint: ${language ?? 'auto-detect'}.`,
    `User command: ${JSON.stringify(text)}`
  ].join('\n');
}
