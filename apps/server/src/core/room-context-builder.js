import { registry, RoomContextSchema } from '@homecraft/contracts';
import {
  loadPlanHistory,
  loadSessionDocument,
  resolveCurrentEntry,
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
 * Writes `value` at a dot-separated path on `target` (mutates target).
 * @param {Record<string, unknown>} target
 * @param {string} path
 * @param {unknown} value
 */
function setPath(target, path, value) {
  if (typeof path !== 'string' || !path) return;
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = cursor[key];
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = /** @type {Record<string, unknown>} */ (cursor[key]);
  }
  cursor[parts[parts.length - 1]] = value;
}

/**
 * Applies manifest.siteBindings onto context.site / context.roomShape.
 * No-op (same object) when the table is missing or empty.
 *
 * @param {{ siteBindings?: Array<{ slot?: string, path?: string }> } | null | undefined} manifest
 * @param {Record<string, unknown>} context
 * @param {{ slots?: Record<string, unknown>, known?: Record<string, unknown> }} sources
 */
export function applySiteBindings(manifest, context, { slots, known } = {}) {
  const bindings = manifest?.siteBindings ?? [];
  if (bindings.length === 0) return context;

  const source = context.site ?? context.roomShape;
  if (source == null) return context;

  const site = structuredClone(source);
  for (const binding of bindings) {
    const slot = binding?.slot;
    const path = binding?.path;
    if (typeof slot !== 'string' || typeof path !== 'string') continue;
    const value = slots?.[slot] ?? known?.[slot];
    if (value == null) continue;
    setPath(/** @type {Record<string, unknown>} */ (site), path, value);
  }
  return { ...context, site, roomShape: site };
}

/**
 * Builds room context for a project session.
 *
 * @param userId - Optional authenticated user
 * @param projectId - Active project identifier
 * @param sessionId - Dialog session id
 * @param inputChannel - Text or voice source for the dialog command
 * @param productType - Active domain; defaults to kitchen
 * @returns RoomContext validated with Zod
 */
export async function buildRoomContext(
  userId,
  projectId,
  sessionId,
  inputChannel = 'text',
  productType = 'kitchen'
) {
  const manifest = registry.get(productType);
  const [session, history, mongoProject] = await Promise.all([
    loadSessionDocument(sessionId),
    loadPlanHistory(sessionId, projectId),
    loadProjectDocument(projectId)
  ]);
  const persisted =
    session.roomContext?.projectId === projectId
      ? session.roomContext
      : mongoProject ?? {};
  const currentEntry = resolveCurrentEntry(history);
  const currentPlan = currentEntry?.plan;
  const fallbackShape = manifest.defaultSite?.() ?? defaultRoomShape();
  const roomShape = persisted.roomShape ?? fallbackShape;
  const site = persisted.site ?? roomShape;
  const context = {
    projectId,
    sessionId,
    userId,
    inputChannel,
    catalogSnapshotId: persisted.catalogSnapshotId ?? DEFAULT_SNAPSHOT,
    roomShape,
    site,
    budgetEur: persisted.budgetEur,
    planOperations: currentPlan?.operations ?? mongoProject?.planOperations ?? [],
    planVersion: currentEntry?.version ?? mongoProject?.planVersion ?? 0,
    dialogTurns: persisted.dialogTurns ?? [],
    journey: persisted.journey,
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
    site: validated.site,
    budgetEur: validated.budgetEur,
    planOperations: validated.planOperations,
    planVersion: validated.planVersion,
    dialogTurns: validated.dialogTurns,
    journey: validated.journey
  });
  return validated;
}
