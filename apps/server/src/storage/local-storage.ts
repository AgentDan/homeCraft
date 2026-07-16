import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientRequest } from '@homecraft/contracts';

const __dirnameStorage = path.dirname(fileURLToPath(import.meta.url));
const serverPackageRoot = path.resolve(__dirnameStorage, '..', '..');

function resolveStorageRoot(): string {
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

function sanitizeId(value: string | undefined, fallback: string): string {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function ensureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function countFiles(directoryPath: string): Promise<number> {
  try {
    return (await readdir(directoryPath, { recursive: true })).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

export async function ensureStorage(): Promise<{ root: string; paths: typeof storagePaths }> {
  await Promise.all(Object.values(storagePaths).map(ensureDirectory));
  return { root: storageRoot, paths: storagePaths };
}

export async function getStorageStatus(): Promise<Record<string, unknown>> {
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

export async function saveSession(session: Record<string, unknown>): Promise<{ sessionId: string; filePath: string }> {
  await ensureStorage();
  const sessionId = sanitizeId(session.sessionId as string | undefined, 'local-session');
  const filePath = path.join(storagePaths.sessions, `${sessionId}.json`);
  const previousSession = await readJsonFile<Record<string, unknown>>(filePath, {});
  const nextSession = {
    ...previousSession,
    ...session,
    sessionId,
    updatedAt: new Date().toISOString()
  };
  await writeJsonFile(filePath, nextSession);
  return { sessionId, filePath };
}

export async function recordCommandRequest(clientRequest: ClientRequest): Promise<Record<string, unknown>> {
  const sessionRef = await saveSession({
    sessionId: clientRequest.sessionId,
    lastRequestId: clientRequest.requestId,
    lastProjectId: clientRequest.projectId
  });
  return { session: sessionRef };
}
