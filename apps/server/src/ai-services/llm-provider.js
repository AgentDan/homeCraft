import { IntentKindSchema, LanguageSchema } from '@homecraft/contracts';
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

/**
 * Prompt for intent-only parsing.
 * @param {string} text
 * @param {string | undefined} language
 */
export function buildIntentParsePrompt(text, language) {
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
    'Slots may include: widthMm, budgetEur, sku, instanceId, finishId, category, layout, branchName, roomWidthMm, roomDepthMm.',
    'Do not invent SKUs or instanceIds. Omit a slot when unsure.',
    `Language hint: ${language ?? 'auto-detect'}.`,
    `User command: ${JSON.stringify(text)}`
  ].join('\n');
}
