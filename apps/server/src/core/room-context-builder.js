import { RoomContextSchema } from '@homecraft/contracts';

const DEFAULT_SNAPSHOT = 'snapshot-step0';

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
 * @param inputChannel - Text or voice source for MODE A
 * @returns RoomContext validated with Zod
 */
export async function buildRoomContext(userId, projectId, sessionId, inputChannel = 'text') {
  const context = {
    projectId,
    sessionId,
    userId,
    inputChannel,
    catalogSnapshotId: DEFAULT_SNAPSHOT,
    roomShape: defaultRoomShape(),
    dialogTurns: [],
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

export function resolveSnapshotId(request, context) {
  return request.catalogSnapshotId ?? context.catalogSnapshotId ?? DEFAULT_SNAPSHOT;
}
