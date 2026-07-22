import { createHash } from 'node:crypto';
import { BOMSchema } from '@homecraft/contracts';
import { calculateBOM } from './calculateBOM.js';
import { getRedisClient, redisConfigured } from '../storage/redis.js';
import { runtimeConfig } from '../config/runtime.js';

const MEMORY_LIMIT = 200;
/** @type {Map<string, string>} */
const memoryCache = new Map();

const stats = {
  hits: 0,
  misses: 0,
  errors: 0
};

/**
 * @param {{ operations?: unknown[] }} plan
 * @param {string} catalogSnapshotId
 */
export function buildBomCacheKey(plan, catalogSnapshotId) {
  const payload = JSON.stringify({
    catalogSnapshotId,
    operations: plan.operations ?? []
  });
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 24);
  return `bom:v1:${catalogSnapshotId}:${digest}`;
}

function rememberMemory(key, value) {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  }
  memoryCache.set(key, value);
  while (memoryCache.size > MEMORY_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

/**
 * Cached BOM lookup: Redis (optional) + in-process memory, with metrics.
 * `calculateBOM` stays a pure calculator.
 *
 * @param {{ operations?: unknown[], catalogSnapshotId?: string }} plan
 * @param {string} catalogSnapshotId
 */
export async function getCachedBOM(plan, catalogSnapshotId) {
  const key = buildBomCacheKey(plan, catalogSnapshotId);

  const memoryHit = memoryCache.get(key);
  if (memoryHit) {
    stats.hits += 1;
    return BOMSchema.parse(JSON.parse(memoryHit));
  }

  const redis = await getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        stats.hits += 1;
        rememberMemory(key, cached);
        return BOMSchema.parse(JSON.parse(cached));
      }
    } catch (error) {
      stats.errors += 1;
      console.warn('[bom-cache] redis get failed:', error);
    }
  }

  stats.misses += 1;
  const bom = await calculateBOM(plan, catalogSnapshotId);
  const serialized = JSON.stringify(bom);
  rememberMemory(key, serialized);

  if (redis) {
    try {
      await redis.set(key, serialized, { EX: runtimeConfig.bomCacheTtlSec });
    } catch (error) {
      stats.errors += 1;
      console.warn('[bom-cache] redis set failed:', error);
    }
  }

  return bom;
}

export function getBomCacheStats() {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    errors: stats.errors,
    hitRate: total === 0 ? 0 : Number((stats.hits / total).toFixed(3)),
    memoryEntries: memoryCache.size,
    redisConfigured: redisConfigured()
  };
}

/** @internal test helper */
export function resetBomCacheForTests() {
  memoryCache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
}
