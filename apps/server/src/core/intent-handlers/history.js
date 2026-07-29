import {
  CommandOutcomeKindSchema,
  IntentKindSchema
} from '@homecraft/contracts';
import { buildClarifyResponse } from '../output-builder.js';
import { runDownstream } from '../run-downstream.js';
import { navigatePlanHistory } from '../../storage/local-storage.js';
import { normalizeLanguage, t } from '../../i18n/messages.js';

const OUTCOME = CommandOutcomeKindSchema.enum;
const INTENT = IntentKindSchema.enum;
const RESPOND = /** @type {const} */ ('respond');
/**
 * Navigates plan history for undo/redo, or clarifies when the stack is empty.
 * Does not call finalizeResponse — route() owns journal and idempotency writes.
 *
 * @param {import('./types.js').IntentHandlerInput} input
 * @returns {Promise<import('./types.js').IntentHandlerResult>}
 */
export async function handleHistory(input) {
  const { request, context, intent } = input;
  const language = normalizeLanguage(request.language);
  const intentKind = intent.kind;
  const entry = await navigatePlanHistory(
    request.sessionId,
    request.projectId,
    intentKind
  );

  if (!entry) {
    const prompt =
      intentKind === INTENT.undo
        ? t(language, 'nothingToUndo')
        : t(language, 'nothingToRedo');
    return {
      kind: RESPOND,
      response: buildClarifyResponse(request, prompt, context.planVersion ?? 0),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false
    };
  }

  const message =
    intentKind === INTENT.undo ? t(language, 'undone') : t(language, 'redone');
  return {
    kind: RESPOND,
    response: await runDownstream({
      request,
      context,
      plan: entry.plan,
      message,
      explanation: `Intent: ${intentKind}`,
      existingVersion: entry.version,
      changeSummary: { text: message, added: [], removed: [], moved: [] },
      view: { kind: '3d_scene', render: 'full' }
    }),
    outcomeKind: OUTCOME.applied,
    createdVersion: false
  };
}
