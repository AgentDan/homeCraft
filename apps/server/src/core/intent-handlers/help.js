import { CommandOutcomeKindSchema } from '@homecraft/contracts';
import { buildHelpResponse } from '../output-builder.js';
import { getHelpOrCatalogMessage } from '../help-service.js';

const OUTCOME = CommandOutcomeKindSchema.enum;
const RESPOND = /** @type {const} */ ('respond');

/**
 * Builds a compact command list (or catalog) ClientResponse.
 *
 * @param {import('./types.js').IntentHandlerInput} input
 * @returns {Promise<import('./types.js').IntentHandlerResult>}
 */
export async function handleHelp(input) {
  const { request, context, language } = input;
  const productType = context.productType ?? 'kitchen';
  const message = await getHelpOrCatalogMessage(
    request.command,
    language,
    context.catalogSnapshotId,
    productType
  );
  return {
    kind: RESPOND,
    response: buildHelpResponse(
      request,
      message,
      context.planVersion ?? 0
    ),
    outcomeKind: OUTCOME.read_only,
    createdVersion: false
  };
}
