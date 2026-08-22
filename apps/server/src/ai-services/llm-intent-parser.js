import { IntentResultSchema } from '@homecraft/contracts';
import { buildIntentParsePrompt } from './llm-provider.js';

const SKU_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/i;
const INSTANCE_PATTERN = /^module-\d+$/i;

/**
 * Calls an LLM provider, validates with IntentResultSchema, sanitizes slots.
 * Returns null when the model output cannot be trusted → caller falls back to rules.
 *
 * @param {string} text
 * @param {'en' | 'ru' | 'sr' | undefined} language
 * @param {{ provider: { complete: (prompt: string) => Promise<string> } }} options
 * @returns {Promise<import('zod').infer<typeof IntentResultSchema> | null>}
 */
export async function parseIntentWithLlm(text, language, options) {
  const rawText = text.trim();
  if (!rawText) return null;

  const completion = await options.provider.complete(
    buildIntentParsePrompt(rawText, language)
  );
  const json = extractJsonObject(completion);
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;

  const candidate = normalizeLlmPayload(json, rawText, language);
  const parsed = IntentResultSchema.safeParse(candidate);
  if (!parsed.success) return null;

  return sanitizeIntent(parsed.data);
}

/**
 * @param {string} text
 * @returns {unknown | null}
 */
export function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * @param {unknown} json
 * @param {string} rawText
 * @param {string | undefined} language
 */
function normalizeLlmPayload(json, rawText, language) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return json;
  const payload = /** @type {Record<string, unknown>} */ ({
    .../** @type {Record<string, unknown>} */ (json)
  });
  payload.rawText = rawText;
  if (!payload.language && language) {
    payload.language = language;
  }
  if (payload.kind === 'unknown') {
    return {
      kind: 'unknown',
      language: payload.language,
      rawText,
      reason:
        typeof payload.reason === 'string' && payload.reason.trim()
          ? payload.reason
          : 'llm_unknown'
    };
  }
  if (typeof payload.confidence !== 'number') {
    payload.confidence = 0.7;
  }
  if (!payload.slots || typeof payload.slots !== 'object') {
    payload.slots = {};
  }
  return payload;
}

/**
 * Drop invented identifiers; keep numeric/category slots intact.
 * @param {import('zod').infer<typeof IntentResultSchema>} intent
 */
function sanitizeIntent(intent) {
  if (intent.kind === 'unknown') return intent;
  const slots = { ...intent.slots };
  if (slots.sku && !SKU_PATTERN.test(slots.sku)) {
    delete slots.sku;
  }
  if (slots.instanceId && !INSTANCE_PATTERN.test(slots.instanceId)) {
    delete slots.instanceId;
  }
  return { ...intent, slots };
}
