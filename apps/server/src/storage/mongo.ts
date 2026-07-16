import { MongoClient, type Db } from 'mongodb';
import { runtimeConfig } from '../config/runtime.js';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Connects to MongoDB. Step0: connection is lazy; failures are logged, not fatal for stub API.
 */
export async function connectMongo(): Promise<Db | null> {
  if (db) {
    return db;
  }
  try {
    client = new MongoClient(runtimeConfig.mongodbUri);
    await client.connect();
    db = client.db();
    return db;
  } catch (error) {
    console.warn('[mongo] connection failed (step0 continues with local storage):', error);
    return null;
  }
}

export async function getMongoDb(): Promise<Db | null> {
  return connectMongo();
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * @throws Error — not implemented in step0
 */
export async function saveProjectDocument(_project: Record<string, unknown>): Promise<void> {
  throw new Error('Not implemented');
}
