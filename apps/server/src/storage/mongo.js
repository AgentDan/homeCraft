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
 *
 * Unique identity is (productType, slot) so two domains can share slot names
 * (e.g. both `budgetEur`). Queries always filter by productType.
 *
 * The ordering index includes productType because every read is per-domain;
 * `{ stage: 1, order: 1 }` alone would interleave kitchen and desk rows.
 * Prefixing productType keeps per-domain stage/order scans valid. The actual
 * find() sorts by `order` after filtering productType — `{ productType, stage, order }`
 * still supports that as a productType-prefixed index.
 */
export const JOURNEY_QUESTION_INDEXES = [
  { key: { productType: 1, stage: 1, order: 1 }, name: 'product_stage_order' },
  { key: { productType: 1, slot: 1 }, name: 'product_slot_unique', unique: true }
];

/** Pre-step-4 index names that collide with the new compound unique key. */
export const LEGACY_JOURNEY_QUESTION_INDEXES = ['slot_unique', 'stage_order'];

/**
 * @param {string} productType
 * @param {string[]} slots
 */
export function journeyQuestionCleanupFilter(productType, slots) {
  if (slots.length > 0) {
    return { productType, slot: { $nin: slots } };
  }
  return { productType };
}

/**
 * Kitchen documents written before productType existed have no productType field.
 * @param {string} productType
 */
export function journeyQuestionReadFilter(productType) {
  if (productType === 'kitchen') {
    return { $or: [{ productType }, { productType: { $exists: false } }] };
  }
  return { productType };
}

/**
 * @param {import('mongodb').Collection} collection
 */
async function ensureJourneyQuestionIndexes(collection) {
  for (const name of LEGACY_JOURNEY_QUESTION_INDEXES) {
    try {
      await collection.dropIndex(name);
    } catch {
      // Fresh collections, or indexes already dropped.
    }
  }
  await collection.createIndexes(JOURNEY_QUESTION_INDEXES);
}

/**
 * Strip storage metadata so callers receive a plain JourneyQuestion.
 * @param {Record<string, unknown>} row
 */
function toJourneyQuestion(row) {
  const {
    _id: _idIgnored,
    createdAt: _createdIgnored,
    updatedAt: _updatedIgnored,
    productType: _typeIgnored,
    ...question
  } = row;
  return question;
}

/**
 * Ensure `journey_questions` collection, indexes, and seed rows for one domain.
 * @param {string} productType
 * @param {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[]} seed
 * @returns {Promise<import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[] | null>}
 */
export async function ensureJourneyQuestions(productType, seed) {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  const collection = database.collection('journey_questions');
  await ensureJourneyQuestionIndexes(collection);

  for (const question of seed) {
    await collection.updateOne(
      { productType, slot: question.slot },
      {
        $set: {
          ...structuredClone(question),
          productType,
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
    .find(journeyQuestionReadFilter(productType), {
      projection: { _id: 0, createdAt: 0, updatedAt: 0, productType: 0 }
    })
    .sort({ order: 1 })
    .toArray();
  return /** @type {typeof seed} */ (rows.map(toJourneyQuestion));
}

/**
 * Unused by current callers (startup uses ensureJourneyQuestions; admin uses
 * the in-memory table). Kept for symmetry / future reads.
 * @param {string} productType
 * @returns {Promise<import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[] | null>}
 */
export async function loadJourneyQuestions(productType) {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  const rows = await database
    .collection('journey_questions')
    .find(journeyQuestionReadFilter(productType), {
      projection: { _id: 0, createdAt: 0, updatedAt: 0, productType: 0 }
    })
    .sort({ order: 1 })
    .toArray();
  return rows.length > 0
    ? /** @type {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[]} */ (
        rows.map(toJourneyQuestion)
      )
    : null;
}

/**
 * Replace one domain's journey_questions (admin save).
 * Cleanup is scoped by productType so saving kitchen cannot delete desk rows.
 * @param {string} productType
 * @param {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>[]} questions
 * @returns {Promise<boolean>} true when Mongo wrote; false when offline
 */
export async function replaceJourneyQuestionsInMongo(productType, questions) {
  const database = await getMongoDb();
  if (!database) {
    return false;
  }
  const collection = database.collection('journey_questions');
  await ensureJourneyQuestionIndexes(collection);
  const slots = questions.map((q) => q.slot);
  await collection.deleteMany(journeyQuestionCleanupFilter(productType, slots));
  for (const question of questions) {
    await collection.updateOne(
      { productType, slot: question.slot },
      {
        $set: {
          ...structuredClone(question),
          productType,
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
