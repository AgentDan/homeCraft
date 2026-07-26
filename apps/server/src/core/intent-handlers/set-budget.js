import { CommandOutcomeKindSchema } from '@homecraft/contracts';
import { buildClarifyResponse } from '../output-builder.js';
import { t } from '../../i18n/messages.js';

const OUTCOME = CommandOutcomeKindSchema.enum;
const RESPOND = /** @type {const} */ ('respond');
const CONTINUE = /** @type {const} */ ('continue');

/**
 * Clarifies when budget is missing; otherwise returns an immutable context with budgetEur.
 * Does not call finalizeResponse — successful path continues into route()'s shared pipeline.
 *
 * @param {import('./types.js').IntentHandlerInput} input
 * @returns {Promise<import('./types.js').IntentHandlerResult>}
 */
export async function handleSetBudget(input) {
  const { request, context, intent, language } = input;
  const budgetEur = intent.slots?.budgetEur;

  if (budgetEur === undefined) {
    return {
      kind: RESPOND,
      response: buildClarifyResponse(
        request,
        t(language, 'budgetClarify'),
        context.planVersion
      ),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false
    };
  }

  // Structured clone via spread — never mutate the input context object.
  return {
    kind: CONTINUE,
    context: { ...context, budgetEur }
  };
}
