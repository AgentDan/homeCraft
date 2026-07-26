import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandRecordSchema, PlanHistorySchema } from '@homecraft/contracts';

const __dirnameStorage = path.dirname(fileURLToPath(import.meta.url));
const serverPackageRoot = path.resolve(__dirnameStorage, '..', '..');

function resolveStorageRoot() {
  const raw = process.env.SERVER_STORAGE_DIR?.trim();
  if (!raw) {
    return path.join(serverPackageRoot, 'data');
  }
  if (path.isAbsolute(raw)) {
    return path.normalize(raw);
  }
  return path.resolve(serverPackageRoot, raw);
}

function getStoragePaths() {
  const storageRoot = resolveStorageRoot();
  return {
    root: storageRoot,
    sessions: path.join(storageRoot, 'sessions'),
    scenes: path.join(storageRoot, 'scenes'),
    actionHistory: path.join(storageRoot, 'action-history'),
    assets: path.join(storageRoot, 'assets'),
    exports: path.join(storageRoot, 'exports')
  };
}

function sanitizeId(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function sessionFilePath(sessionId) {
  return path.join(
    getStoragePaths().sessions,
    `${sanitizeId(sessionId, 'local-session')}.json`
  );
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

function isNotFoundError(error) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (isNotFoundError(error)) {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath, payload) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function countFiles(directoryPath) {
  try {
    return (await readdir(directoryPath, { recursive: true })).length;
  } catch (error) {
    if (isNotFoundError(error)) {
      return 0;
    }
    throw error;
  }
}

export async function ensureStorage() {
  const storagePaths = getStoragePaths();
  await Promise.all(
    Object.values(storagePaths)
      .filter((value) => value !== storagePaths.root)
      .map(ensureDirectory)
  );
  return { root: storagePaths.root, paths: storagePaths };
}

export async function getStorageStatus() {
  const { root, paths } = await ensureStorage();
  return {
    root,
    sessions: await countFiles(paths.sessions),
    scenes: await countFiles(paths.scenes),
    actionHistory: await countFiles(paths.actionHistory),
    assets: await countFiles(paths.assets),
    exports: await countFiles(paths.exports)
  };
}

export async function saveSession(session) {
  await ensureStorage();
  const sessionId = sanitizeId(session.sessionId, 'local-session');
  const filePath = sessionFilePath(sessionId);
  const previousSession = await readJsonFile(filePath, {});
  const nextSession = {
    ...previousSession,
    ...session,
    sessionId,
    updatedAt: new Date().toISOString()
  };
  await writeJsonFile(filePath, nextSession);
  return { sessionId, filePath };
}

export async function loadSessionDocument(sessionId) {
  await ensureStorage();
  return readJsonFile(sessionFilePath(sessionId), {});
}

export async function saveRoomContextState(sessionId, context) {
  return saveSession({
    sessionId,
    roomContext: {
      projectId: context.projectId,
      catalogSnapshotId: context.catalogSnapshotId,
      roomShape: structuredClone(context.roomShape),
      budgetEur: context.budgetEur,
      dialogTurns: structuredClone(context.dialogTurns),
      updatedAt: context.updatedAt
    }
  });
}

export async function recordCommandRequest(clientRequest) {
  const sessionRef = await saveSession({
    sessionId: clientRequest.sessionId,
    lastRequestId: clientRequest.requestId,
    lastProjectId: clientRequest.projectId
  });
  return { session: sessionRef };
}

function createEmptyPlanHistory(projectId) {
  return PlanHistorySchema.parse({
    projectId,
    entries: [],
    currentIndex: -1,
    nextVersion: 1
  });
}

export async function loadPlanHistory(sessionId, projectId) {
  await ensureStorage();
  const session = await readJsonFile(sessionFilePath(sessionId), {});
  if (!session.planHistory || session.planHistory.projectId !== projectId) {
    return createEmptyPlanHistory(projectId);
  }
  return PlanHistorySchema.parse(structuredClone(session.planHistory));
}

export async function getCurrentPlanVersion(sessionId, projectId) {
  const history = await loadPlanHistory(sessionId, projectId);
  if (history.currentIndex < 0 || history.entries.length === 0) {
    return 0;
  }
  return history.entries[history.currentIndex].version;
}

export class VersionConflictError extends Error {
  /**
   * @param {number} currentVersion
   * @param {number} expectedVersion
   */
  constructor(currentVersion, expectedVersion) {
    super('version_conflict');
    this.name = 'VersionConflictError';
    this.code = 'version_conflict';
    this.currentVersion = currentVersion;
    this.expectedVersion = expectedVersion;
  }
}

/**
 * @param {string} sessionId
 * @param {string} requestId
 * @returns {Promise<{ statusCode: number, response: object } | null>}
 */
export async function loadIdempotentResponse(sessionId, requestId) {
  const session = await loadSessionDocument(sessionId);
  const entry = session.idempotency?.[requestId];
  if (!entry?.response || typeof entry.statusCode !== 'number') {
    return null;
  }
  return {
    statusCode: entry.statusCode,
    response: structuredClone(entry.response)
  };
}

/**
 * @param {string} sessionId
 * @param {string} requestId
 * @param {number} statusCode
 * @param {object} response
 */
export async function saveIdempotentResponse(
  sessionId,
  requestId,
  statusCode,
  response
) {
  const session = await loadSessionDocument(sessionId);
  const idempotency = {
    ...(session.idempotency && typeof session.idempotency === 'object'
      ? session.idempotency
      : {}),
    [requestId]: {
      statusCode,
      response: structuredClone(response),
      savedAt: new Date().toISOString()
    }
  };
  const keys = Object.keys(idempotency);
  if (keys.length > 100) {
    for (const key of keys.slice(0, keys.length - 100)) {
      delete idempotency[key];
    }
  }
  await saveSession({ sessionId, idempotency });
}

export async function appendPlanVersion(
  sessionId,
  projectId,
  plan,
  requestId,
  expectedVersion
) {
  const history = await loadPlanHistory(sessionId, projectId);
  const currentVersion =
    history.currentIndex < 0 || history.entries.length === 0
      ? 0
      : history.entries[history.currentIndex].version;

  if (
    expectedVersion !== undefined &&
    expectedVersion !== null &&
    expectedVersion !== currentVersion
  ) {
    throw new VersionConflictError(currentVersion, expectedVersion);
  }

  const retainedEntries = history.entries.slice(0, history.currentIndex + 1);
  const createdAt = new Date().toISOString();
  const entry = {
    version: history.nextVersion,
    plan: structuredClone(plan),
    ...(requestId ? { requestId, createdAt } : { createdAt })
  };
  const nextHistory = PlanHistorySchema.parse({
    projectId,
    entries: [...retainedEntries, entry],
    currentIndex: retainedEntries.length,
    nextVersion: history.nextVersion + 1
  });

  await saveSession({ sessionId, planHistory: nextHistory });
  return structuredClone(entry);
}

export async function navigatePlanHistory(sessionId, projectId, direction) {
  const history = await loadPlanHistory(sessionId, projectId);
  const offset = direction === 'undo' ? -1 : 1;
  const targetIndex = history.currentIndex + offset;

  if (targetIndex < 0 || targetIndex >= history.entries.length) {
    return null;
  }

  const nextHistory = PlanHistorySchema.parse({
    ...history,
    currentIndex: targetIndex
  });
  await saveSession({ sessionId, planHistory: nextHistory });
  return structuredClone(nextHistory.entries[targetIndex]);
}

function commandJournalPath(projectId) {
  return path.join(
    getStoragePaths().actionHistory,
    `${sanitizeId(projectId, 'project')}.jsonl`
  );
}

export async function loadCommandJournal(projectId) {
  await ensureStorage();
  const filePath = commandJournalPath(projectId);
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const records = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(CommandRecordSchema.parse(JSON.parse(trimmed)));
    } catch (error) {
      console.warn(
        `[command-journal] skip bad line ${index + 1} in ${filePath}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  return records;
}

export async function getNextCommandSeq(projectId) {
  const journal = await loadCommandJournal(projectId);
  return journal.length + 1;
}

export async function appendCommandRecord(record) {
  await ensureStorage();
  const parsed = CommandRecordSchema.parse(record);
  const filePath = commandJournalPath(parsed.projectId);
  await appendFile(filePath, `${JSON.stringify(parsed)}\n`);
  return parsed;
}

/** @type {Map<string, Promise<void>>} */
const sessionLocks = new Map();

/**
 * Serialize mutations for one session (file-store optimistic locking).
 * @template T
 * @param {string} sessionId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withSessionLock(sessionId, fn) {
  const key = sanitizeId(sessionId, 'local-session');
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => gate);
  sessionLocks.set(key, chained);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (sessionLocks.get(key) === chained) {
      sessionLocks.delete(key);
    }
  }
}
