import { MongoClient } from 'mongodb';
import { runtimeConfig } from '../config/runtime.js';

let client = null;
let db = null;

/**
 * Connects to MongoDB. Step0: connection is lazy; failures are logged, not fatal for stub API.
 */
export async function connectMongo() {
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

export async function getMongoDb() {
  return connectMongo();
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * @throws Error — not implemented in step0
 */
export async function saveProjectDocument(_project) {
  throw new Error('Not implemented');
}
