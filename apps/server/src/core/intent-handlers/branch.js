import {
  CommandOutcomeKindSchema,
  IntentKindSchema,
  createEmptyPlan
} from '@homecraft/contracts';
import { buildClarifyResponse } from '../output-builder.js';
import { runDownstream } from '../run-downstream.js';
import {
  createPlanBranch,
  switchPlanBranch
} from '../../storage/local-storage.js';
import { normalizeLanguage, t } from '../../i18n/messages.js';

const OUTCOME = CommandOutcomeKindSchema.enum;
const INTENT = IntentKindSchema.enum;
const RESPOND = /** @type {const} */ ('respond');

/**
 * @param {import('./types.js').IntentHandlerInput} input
 * @param {object | null | undefined} entry
 * @param {string} message
 * @param {string} intentKind
 */
async function respondWithBranchPlan(input, entry, message, intentKind) {
  const { request, context } = input;
  const plan =
    entry?.plan ??
    createEmptyPlan({
      planId: `plan-${request.projectId}-empty`,
      projectId: request.projectId,
      catalogSnapshotId: context.catalogSnapshotId,
      productType: context.productType
    });
  const version = entry?.version ?? 0;

  return {
    kind: RESPOND,
    response: await runDownstream({
      request,
      context,
      plan,
      message,
      intentKind,
      existingVersion: version,
      changeSummary: { text: message, added: [], removed: [], moved: [] },
      view: { kind: '3d_scene', render: 'full' }
    }),
    outcomeKind: OUTCOME.applied,
    createdVersion: false
  };
}

/**
 * Creates or switches plan-history branches.
 * Does not call finalizeResponse — route() owns journal and idempotency writes.
 *
 * @param {import('./types.js').IntentHandlerInput} input
 * @returns {Promise<import('./types.js').IntentHandlerResult>}
 */
export async function handleBranch(input) {
  const { request, intent } = input;
  const language = normalizeLanguage(request.language);
  const intentKind = intent.kind;
  const branchName =
    typeof intent.slots?.branchName === 'string'
      ? intent.slots.branchName
      : undefined;

  if (intentKind === INTENT.create_branch) {
    const result = await createPlanBranch(
      request.sessionId,
      request.projectId,
      branchName
    );
    if (!result.ok && result.reason === 'empty') {
      return {
        kind: RESPOND,
        response: buildClarifyResponse(
          request,
          t(language, 'branchEmpty'),
          0
        ),
        outcomeKind: OUTCOME.clarify,
        createdVersion: false
      };
    }
    if (!result.ok && result.reason === 'exists') {
      return {
        kind: RESPOND,
        response: buildClarifyResponse(
          request,
          t(language, 'branchExists', { name: result.name ?? '' }),
          input.context.planVersion ?? 0
        ),
        outcomeKind: OUTCOME.clarify,
        createdVersion: false
      };
    }
    if (!result.ok) {
      return {
        kind: RESPOND,
        response: buildClarifyResponse(
          request,
          t(language, 'branchEmpty'),
          input.context.planVersion ?? 0
        ),
        outcomeKind: OUTCOME.clarify,
        createdVersion: false
      };
    }

    return respondWithBranchPlan(
      input,
      result.entry,
      t(language, 'branchCreated', { name: result.branch.name }),
      intentKind
    );
  }

  const result = await switchPlanBranch(
    request.sessionId,
    request.projectId,
    branchName ?? ''
  );
  if (!result.ok && result.reason === 'missing_name') {
    return {
      kind: RESPOND,
      response: buildClarifyResponse(
        request,
        t(language, 'branchSwitchClarify'),
        input.context.planVersion ?? 0
      ),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false
    };
  }
  if (!result.ok) {
    return {
      kind: RESPOND,
      response: buildClarifyResponse(
        request,
        t(language, 'branchNotFound', { name: branchName ?? '' }),
        input.context.planVersion ?? 0
      ),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false
    };
  }

  return respondWithBranchPlan(
    input,
    result.entry,
    t(language, 'branchSwitched', { name: result.branch.name }),
    intentKind
  );
}
