import { CommandOutcomeKindSchema } from '@homecraft/contracts';
import { buildUnknownIntentResponse } from '../output-builder.js';

const OUTCOME = CommandOutcomeKindSchema.enum;
const RESPOND = /** @type {const} */ ('respond');

/**
 * Builds a clarify response when the command did not match a known intent.
 *
 * @param {import('./types.js').IntentHandlerInput} input
 * @returns {Promise<import('./types.js').IntentHandlerResult>}
 */
export async function handleUnknown(input) {
  const { request, context } = input;
  return {
    kind: RESPOND,
    response: buildUnknownIntentResponse(
      request,
      context,
      context.planVersion ?? 0
    ),
    outcomeKind: OUTCOME.clarify,
    createdVersion: false
  };
}
