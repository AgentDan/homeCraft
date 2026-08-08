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

/**
 * Ensure `journey_questions` collection, indexes, and seed rows.
 * @param {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[]} seed
 * @returns {Promise<import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[] | null>}
 */
export async function ensureJourneyQuestions(seed) {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  const collection = database.collection('journey_questions');
  await collection.createIndexes([
    { key: { stage: 1, order: 1 }, name: 'stage_order' },
    { key: { slot: 1 }, name: 'slot_unique', unique: true }
  ]);

  for (const question of seed) {
    await collection.updateOne(
      { slot: question.slot },
      {
        $set: {
          ...structuredClone(question),
          updatedAt: new Date().toISOString()
        },
        $setOnInsert: {
          createdAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  }

  const rows = await collection
    .find({}, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } })
    .sort({ order: 1 })
    .toArray();
  return /** @type {typeof seed} */ (rows);
}

/**
 * @returns {Promise<import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[] | null>}
 */
export async function loadJourneyQuestions() {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  const rows = await database
    .collection('journey_questions')
    .find({}, { projection: { _id: 0, createdAt: 0, updatedAt: 0 } })
    .sort({ order: 1 })
    .toArray();
  return rows.length > 0
    ? /** @type {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[]} */ (
        rows
      )
    : null;
}

/**
 * Replace the full journey_questions collection (admin save).
 * @param {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[]} questions
 * @returns {Promise<boolean>} true when Mongo wrote; false when offline
 */
export async function replaceJourneyQuestionsInMongo(questions) {
  const database = await getMongoDb();
  if (!database) {
    return false;
  }
  const collection = database.collection('journey_questions');
  await collection.createIndexes([
    { key: { stage: 1, order: 1 }, name: 'stage_order' },
    { key: { slot: 1 }, name: 'slot_unique', unique: true }
  ]);
  const slots = questions.map((q) => q.slot);
  if (slots.length > 0) {
    await collection.deleteMany({ slot: { $nin: slots } });
  } else {
    await collection.deleteMany({});
  }
  for (const question of questions) {
    await collection.updateOne(
      { slot: question.slot },
      {
        $set: {
          ...structuredClone(question),
          updatedAt: new Date().toISOString()
        },
        $setOnInsert: {
          createdAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  }
  return true;
}
