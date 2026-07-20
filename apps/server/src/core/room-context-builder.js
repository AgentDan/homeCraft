import { RoomContextSchema } from '@homecraft/contracts';
import {
  loadPlanHistory,
  loadSessionDocument,
  saveRoomContextState
} from '../storage/local-storage.js';
import {
  loadProjectDocument,
  saveProjectDocument
} from '../storage/mongo.js';
import { DEFAULT_CATALOG_SNAPSHOT_ID } from '../knowledge-base/catalog-store.js';

const DEFAULT_SNAPSHOT = DEFAULT_CATALOG_SNAPSHOT_ID;

function defaultRoomShape() {
  return {
    dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
    walls: [],
    openings: [],
    utilities: []
  };
}

/**
 * Builds room context for a project session.
 *
 * @param userId - Optional authenticated user
 * @param projectId - Active project identifier
 * @param sessionId - Dialog session id
 * @param inputChannel - Text or voice source for the dialog command
 * @returns RoomContext validated with Zod
 */
export async function buildRoomContext(userId, projectId, sessionId, inputChannel = 'text') {
  const [session, history, mongoProject] = await Promise.all([
    loadSessionDocument(sessionId),
    loadPlanHistory(sessionId, projectId),
    loadProjectDocument(projectId)
  ]);
  const persisted =
    session.roomContext?.projectId === projectId
      ? session.roomContext
      : mongoProject ?? {};
  const currentPlan = history.entries[history.currentIndex]?.plan;
  const context = {
    projectId,
    sessionId,
    userId,
    inputChannel,
    catalogSnapshotId: persisted.catalogSnapshotId ?? DEFAULT_SNAPSHOT,
    roomShape: persisted.roomShape ?? defaultRoomShape(),
    budgetEur: persisted.budgetEur,
    planOperations: currentPlan?.operations ?? mongoProject?.planOperations ?? [],
    planVersion:
      history.entries[history.currentIndex]?.version
      ?? mongoProject?.planVersion
      ?? 0,
    dialogTurns: persisted.dialogTurns ?? [],
    updatedAt: new Date().toISOString()
  };
  return RoomContextSchema.parse(context);
}

/**
 * Appends a dialog turn to in-memory context clone.
 */
export function appendDialogTurn(context, role, text) {
  const next = structuredClone(context);
  next.dialogTurns.push({ role, text, at: new Date().toISOString() });
  next.updatedAt = new Date().toISOString();
  return RoomContextSchema.parse(next);
}

export async function persistRoomContext(context) {
  const validated = RoomContextSchema.parse({
    ...context,
    updatedAt: new Date().toISOString()
  });
  await saveRoomContextState(validated.sessionId, validated);
  await saveProjectDocument({
    projectId: validated.projectId,
    sessionId: validated.sessionId,
    catalogSnapshotId: validated.catalogSnapshotId,
    roomShape: validated.roomShape,
    budgetEur: validated.budgetEur,
    planOperations: validated.planOperations,
    planVersion: validated.planVersion,
    dialogTurns: validated.dialogTurns
  });
  return validated;
}
