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

async function saveSession(session) {
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

const MAIN_BRANCH_ID = 'main';

function createEmptyPlanHistory(projectId) {
  return PlanHistorySchema.parse({
    projectId,
    entries: [],
    branches: [
      {
        id: MAIN_BRANCH_ID,
        name: MAIN_BRANCH_ID,
        versions: [],
        currentIndex: -1,
        baseVersion: null
      }
    ],
    activeBranchId: MAIN_BRANCH_ID,
    nextVersion: 1
  });
}

/**
 * @param {import('zod').infer<typeof PlanHistorySchema>} history
 */
function getActiveBranch(history) {
  return (
    history.branches.find((branch) => branch.id === history.activeBranchId) ??
    history.branches[0] ??
    null
  );
}

/**
 * @param {import('zod').infer<typeof PlanHistorySchema>} history
 */
export function resolveCurrentEntry(history) {
  const branch = getActiveBranch(history);
  if (!branch) {
    return null;
  }
  if (branch.currentIndex >= 0) {
    const version = branch.versions[branch.currentIndex];
    if (typeof version === 'number') {
      return history.entries.find((entry) => entry.version === version) ?? null;
    }
  }
  if (branch.baseVersion != null) {
    return (
      history.entries.find((entry) => entry.version === branch.baseVersion) ??
      null
    );
  }
  return null;
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
  return resolveCurrentEntry(history)?.version ?? 0;
}

/**
 * @param {string} sessionId
 * @param {string} projectId
 */
export async function getActiveBranchMeta(sessionId, projectId) {
  const history = await loadPlanHistory(sessionId, projectId);
  const branch = getActiveBranch(history);
  return {
    branchId: branch?.id ?? MAIN_BRANCH_ID,
    branchName: branch?.name ?? MAIN_BRANCH_ID
  };
}

/**
 * @param {number} currentVersion
 * @param {number} expectedVersion
 * @returns {Error & {
 *   code: 'version_conflict',
 *   currentVersion: number,
 *   expectedVersion: number
 * }}
 */
function createVersionConflictError(currentVersion, expectedVersion) {
  const error = /** @type {Error & {
 *   code: 'version_conflict',
 *   currentVersion: number,
 *   expectedVersion: number
 * }} */ (new Error('version_conflict'));
  error.name = 'VersionConflictError';
  error.code = 'version_conflict';
  error.currentVersion = currentVersion;
  error.expectedVersion = expectedVersion;
  return error;
}

/**
 * @param {unknown} error
 * @returns {error is Error & { code: 'version_conflict', currentVersion: number, expectedVersion: number }}
 */
export function isVersionConflictError(error) {
  return (
    error instanceof Error &&
    /** @type {{ code?: string }} */ (error).code === 'version_conflict'
  );
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
  const branch = getActiveBranch(history);
  if (!branch) {
    throw new Error('plan_history_missing_branch');
  }
  const currentVersion = resolveCurrentEntry(history)?.version ?? 0;

  if (
    expectedVersion !== undefined &&
    expectedVersion !== null &&
    expectedVersion !== currentVersion
  ) {
    throw createVersionConflictError(currentVersion, expectedVersion);
  }

  const retainedVersions =
    branch.currentIndex < 0
      ? []
      : branch.versions.slice(0, branch.currentIndex + 1);
  const parentVersion =
    retainedVersions.length > 0
      ? retainedVersions[retainedVersions.length - 1]
      : branch.baseVersion;
  const createdAt = new Date().toISOString();
  const entry = {
    version: history.nextVersion,
    plan: structuredClone(plan),
    branchId: branch.id,
    parentVersion,
    ...(requestId ? { requestId, createdAt } : { createdAt })
  };
  const nextBranch = {
    ...branch,
    versions: [...retainedVersions, entry.version],
    currentIndex: retainedVersions.length
  };
  const nextHistory = PlanHistorySchema.parse({
    projectId,
    entries: [...history.entries, entry],
    branches: history.branches.map((item) =>
      item.id === branch.id ? nextBranch : item
    ),
    activeBranchId: history.activeBranchId,
    nextVersion: history.nextVersion + 1
  });

  await saveSession({ sessionId, planHistory: nextHistory });
  return structuredClone(entry);
}

export async function navigatePlanHistory(sessionId, projectId, direction) {
  const history = await loadPlanHistory(sessionId, projectId);
  const branch = getActiveBranch(history);
  if (!branch) {
    return null;
  }
  const offset = direction === 'undo' ? -1 : 1;
  const targetIndex = branch.currentIndex + offset;

  if (targetIndex >= branch.versions.length) {
    return null;
  }
  // Root main cannot undo past the first commit (matches legacy linear stack).
  if (targetIndex < 0 && branch.baseVersion == null) {
    return null;
  }
  if (targetIndex < -1) {
    return null;
  }

  const nextBranch = { ...branch, currentIndex: targetIndex };
  const nextHistory = PlanHistorySchema.parse({
    ...history,
    branches: history.branches.map((item) =>
      item.id === branch.id ? nextBranch : item
    )
  });
  await saveSession({ sessionId, planHistory: nextHistory });
  const entry = resolveCurrentEntry(nextHistory);
  return entry ? structuredClone(entry) : null;
}

function sanitizeBranchName(value) {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 48);
}

/**
 * Forks a new branch from the current tip and activates it.
 * @param {string} sessionId
 * @param {string} projectId
 * @param {string} [requestedName]
 * @returns {Promise<
 *   | { ok: true, branch: object, entry: object }
 *   | { ok: false, reason: 'empty' | 'exists', name?: string }
 * >}
 */
export async function createPlanBranch(sessionId, projectId, requestedName) {
  const history = await loadPlanHistory(sessionId, projectId);
  const entry = resolveCurrentEntry(history);
  if (!entry) {
    return { ok: false, reason: 'empty' };
  }

  const fallbackName = `branch-${history.branches.length + 1}`;
  const name = sanitizeBranchName(requestedName) || fallbackName;
  const exists = history.branches.some(
    (branch) =>
      branch.id === name || branch.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    return { ok: false, reason: 'exists', name };
  }

  const branch = {
    id: name,
    name,
    versions: [],
    currentIndex: -1,
    baseVersion: entry.version,
    createdAt: new Date().toISOString()
  };
  const nextHistory = PlanHistorySchema.parse({
    ...history,
    branches: [...history.branches, branch],
    activeBranchId: branch.id
  });
  await saveSession({ sessionId, planHistory: nextHistory });
  return {
    ok: true,
    branch,
    entry: structuredClone(entry)
  };
}

/**
 * Activates an existing branch by id or name.
 * @param {string} sessionId
 * @param {string} projectId
 * @param {string} nameOrId
 * @returns {Promise<
 *   | { ok: true, branch: object, entry: object | null }
 *   | { ok: false, reason: 'missing_name' | 'not_found' }
 * >}
 */
export async function switchPlanBranch(sessionId, projectId, nameOrId) {
  const needle = sanitizeBranchName(nameOrId);
  if (!needle) {
    return { ok: false, reason: 'missing_name' };
  }

  const history = await loadPlanHistory(sessionId, projectId);
  const branch = history.branches.find(
    (item) =>
      item.id.toLowerCase() === needle || item.name.toLowerCase() === needle
  );
  if (!branch) {
    return { ok: false, reason: 'not_found' };
  }

  const nextHistory = PlanHistorySchema.parse({
    ...history,
    activeBranchId: branch.id
  });
  await saveSession({ sessionId, planHistory: nextHistory });
  const entry = resolveCurrentEntry(nextHistory);
  return {
    ok: true,
    branch,
    entry: entry ? structuredClone(entry) : null
  };
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
  /** @type {Promise<void>} */
  const gate = new Promise((resolve) => {
    release = () => {
      resolve();
    };
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
