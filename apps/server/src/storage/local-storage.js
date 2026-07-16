import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
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
    if (error.code === 'ENOENT') {
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
  const filePath = path.join(storagePaths.sessions, `${sessionId}.json`);
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

export async function recordCommandRequest(clientRequest) {
  const sessionRef = await saveSession({
    sessionId: clientRequest.sessionId,
    lastRequestId: clientRequest.requestId,
    lastProjectId: clientRequest.projectId
  });
  return { session: sessionRef };
}
