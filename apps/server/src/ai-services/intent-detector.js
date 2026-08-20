import { registry } from '@homecraft/contracts';
import { createHttpLlmProvider } from './llm-provider.js';
import { parseIntentWithLlm } from './llm-intent-parser.js';

/**
 * Detects user intent from natural language (EN/RU/SR).
 *
 * Step 8: when HOMECRAFT_LLM_INTENT is on (and configured), try LLM → Zod.
 * Any failure falls back silently to rule-based matchIntent.
 *
 * Deterministic help/catalog phrases always prefer rules so journey/LLM
 * cannot swallow "catalog" / "help" / "какие команды".
 *
 * @param {string} text - User command
 * @param {'en' | 'ru' | 'sr'} [language]
 * @param {{
 *   llmProvider?: { complete: (prompt: string) => Promise<string> } | null,
 *   productType?: string
 * }} [options] - tests may inject a mock provider
 * @returns {Promise<import('zod').infer<typeof import('@homecraft/contracts').IntentResultSchema>>}
 */
export async function detectIntent(text, language, options = {}) {
  const { matchIntent } = await import('@homecraft/ai');
  const productType = options.productType ?? 'kitchen';
  const rules = registry.get(productType).intentRules;
  const ruleIntent = matchIntent(text, rules, { language });
  if (ruleIntent.kind === 'help') {
    return ruleIntent;
  }

  const injected = Object.hasOwn(options, 'llmProvider');
  const provider = injected
    ? options.llmProvider
    : createHttpLlmProvider();

  if (provider) {
    try {
      const llmIntent = await parseIntentWithLlm(text, language, { provider });
      if (llmIntent && llmIntent.kind !== 'unknown') {
        return llmIntent;
      }
      // LLM "unknown" → still try rules (other short commands).
      if (ruleIntent.kind !== 'unknown') {
        return ruleIntent;
      }
      if (llmIntent) return llmIntent;
    } catch (error) {
      console.warn(
        '[llm-intent] falling back to rules:',
        error instanceof Error ? error.message : error
      );
    }
  }

  return ruleIntent;
}
