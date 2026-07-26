import { CommandOutcomeKindSchema } from '@homecraft/contracts';
import { buildClarifyResponse } from '../output-builder.js';
import { buildExportClientResponse } from '../export-response-builder.js';
import { t } from '../../i18n/messages.js';

const OUTCOME = CommandOutcomeKindSchema.enum;
const RESPOND = /** @type {const} */ ('respond');

/**
 * Exports a frozen PDF for a non-empty plan, or clarifies when the plan has no modules.
 * Does not call finalizeResponse — route() owns journal writes.
 *
 * @param {import('./types.js').IntentHandlerInput} input
 * @returns {Promise<import('./types.js').IntentHandlerResult>}
 */
export async function handleExportProject(input) {
  const { request, context, plan, language } = input;
  const planVersion = context.planVersion ?? 0;

  if (!plan?.operations?.length) {
    return {
      kind: RESPOND,
      response: buildClarifyResponse(
        request,
        t(language, 'exportEmpty'),
        planVersion
      ),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false
    };
  }

  return {
    kind: RESPOND,
    response: await buildExportClientResponse(input, planVersion),
    outcomeKind: OUTCOME.read_only,
    createdVersion: false
  };
}
