import { createClient } from 'redis';
import { runtimeConfig } from '../config/runtime.js';

/** @type {ReturnType<typeof createClient> | null} */
let client = null;
let connectionAttempted = false;

/** Lazy Redis connect; BOM cache falls back to memory when offline. */
export async function connectRedis() {
  if (client?.isOpen) {
    return client;
  }
  if (connectionAttempted || !runtimeConfig.redisUrl) {
    return null;
  }
  connectionAttempted = true;
  try {
    client = createClient({
      url: runtimeConfig.redisUrl,
      socket: {
        connectTimeout: runtimeConfig.redisTimeoutMs
      }
    });
    client.on('error', (error) => {
      console.warn('[redis] client error:', error instanceof Error ? error.message : error);
    });
    await client.connect();
    return client;
  } catch (error) {
    console.warn('[redis] connection failed; using memory BOM cache:', error);
    client = null;
    return null;
  }
}

export async function getRedisClient() {
  return connectRedis();
}

export async function closeRedis() {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
  connectionAttempted = false;
}

export function redisConfigured() {
  return Boolean(runtimeConfig.redisUrl);
}
