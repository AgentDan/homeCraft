import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanHistorySchema } from '@homecraft/contracts';

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

const storageRoot = resolveStorageRoot();

const storagePaths = {
  sessions: path.join(storageRoot, 'sessions'),
  scenes: path.join(storageRoot, 'scenes'),
  actionHistory: path.join(storageRoot, 'action-history'),
  assets: path.join(storageRoot, 'assets'),
  exports: path.join(storageRoot, 'exports')
};

function sanitizeId(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function sessionFilePath(sessionId) {
  return path.join(
    storagePaths.sessions,
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
  await Promise.all(Object.values(storagePaths).map(ensureDirectory));
  return { root: storageRoot, paths: storagePaths };
}

export async function getStorageStatus() {
  await ensureStorage();
  return {
    root: storageRoot,
    sessions: await countFiles(storagePaths.sessions),
    scenes: await countFiles(storagePaths.scenes),
    actionHistory: await countFiles(storagePaths.actionHistory),
    assets: await countFiles(storagePaths.assets),
    exports: await countFiles(storagePaths.exports)
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

export async function appendPlanVersion(sessionId, projectId, plan) {
  const history = await loadPlanHistory(sessionId, projectId);
  const retainedEntries = history.entries.slice(0, history.currentIndex + 1);
  const entry = {
    version: history.nextVersion,
    plan: structuredClone(plan)
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
