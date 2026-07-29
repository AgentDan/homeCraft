export const nodeEnv = process.env.NODE_ENV ?? 'development';
export const isProduction = nodeEnv === 'production';

export function runtimeLabel() {
  return isProduction ? 'production' : 'development';
}

export function corsAllowOrigin() {
  if (!isProduction) return '*';
  const origin = process.env.CORS_ORIGIN?.trim();
  return origin || '*';
}

export const runtimeConfig = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv,
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/homecraft',
  mongodbTimeoutMs: Number(process.env.MONGODB_TIMEOUT_MS ?? 500),
  redisUrl: process.env.REDIS_URL?.trim() || '',
  redisTimeoutMs: Number(process.env.REDIS_TIMEOUT_MS ?? 500),
  bomCacheTtlSec: Number(process.env.BOM_CACHE_TTL_SEC ?? 3600),
  embeddingsProvider: process.env.EMBEDDINGS_PROVIDER ?? 'local-hash',
  kbTopK: Number(process.env.KB_TOP_K ?? 5),
  /** Step 8: LLM intent parser (off → rule-based matchIntent). */
  llmIntentEnabled: isTruthy(process.env.HOMECRAFT_LLM_INTENT),
  llmApiUrl:
    process.env.HOMECRAFT_LLM_API_URL?.trim()
    || 'https://api.openai.com/v1/chat/completions',
  llmApiKey: process.env.HOMECRAFT_LLM_API_KEY?.trim() || '',
  llmModel: process.env.HOMECRAFT_LLM_MODEL?.trim() || 'gpt-4o-mini',
  llmTimeoutMs: Number(process.env.HOMECRAFT_LLM_TIMEOUT_MS ?? 8000)
};

/**
 * @param {unknown} value
 */
function isTruthy(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/** True when the flag is on and a provider endpoint is usable. */
export function llmIntentConfigured() {
  if (!runtimeConfig.llmIntentEnabled) return false;
  if (runtimeConfig.llmApiKey) return true;
  // Custom URL (e.g. local OpenAI-compatible server) may omit an API key.
  return Boolean(process.env.HOMECRAFT_LLM_API_URL?.trim());
}
