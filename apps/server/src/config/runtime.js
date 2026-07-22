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
  kbTopK: Number(process.env.KB_TOP_K ?? 5)
};
