import { MongoClient } from 'mongodb';
import { runtimeConfig } from '../config/runtime.js';

/** @type {MongoClient | null} */
let client = null;
/** @type {import('mongodb').Db | null} */
let db = null;
let connectionAttempted = false;

/** Connects lazily; local persistence remains available when MongoDB is offline. */
export async function connectMongo() {
  if (db) {
    return db;
  }
  if (connectionAttempted) {
    return null;
  }
  connectionAttempted = true;
  try {
    client = new MongoClient(runtimeConfig.mongodbUri, {
      serverSelectionTimeoutMS: runtimeConfig.mongodbTimeoutMs
    });
    await client.connect();
    db = client.db();
    return db;
  } catch (error) {
    console.warn('[mongo] connection failed; using local storage:', error);
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
    connectionAttempted = false;
  }
}

export async function saveProjectDocument(project) {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  await database.collection('projects').replaceOne(
    { projectId: project.projectId },
    { ...structuredClone(project), updatedAt: new Date().toISOString() },
    { upsert: true }
  );
  return structuredClone(project);
}

export async function loadProjectDocument(projectId) {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  return database.collection('projects').findOne(
    { projectId },
    { projection: { _id: 0 } }
  );
}
