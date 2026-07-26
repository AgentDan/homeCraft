import { IntentKindSchema } from '@homecraft/contracts';
import { t } from '../i18n/messages.js';

const INTENT = IntentKindSchema.enum;

/**
 * Localized success message for the default (non-handler) intent path.
 * Kept separate from output-builder: this is intent/outcome copy, not ClientResponse shaping.
 *
 * @param {import('./intent-handlers/types.js').Intent} intent
 * @param {import('./intent-handlers/types.js').PlanOutcome} outcome
 * @param {import('./intent-handlers/types.js').Language} language
 * @returns {string}
 */
export function buildIntentMessage(intent, outcome, language) {
  const messages = {
    [INTENT.add_module]:
      (outcome.addedCount ?? 0) > 1
        ? t(language, 'starterKitchenAdded', {
            count: outcome.addedCount ?? 0
          })
        : t(language, 'moduleAdded', { sku: outcome.sku ?? '' }),
    [INTENT.remove_module]: t(language, 'moduleRemoved', {
      instanceId: outcome.instanceId ?? ''
    }),
    [INTENT.replace_module]: t(language, 'moduleReplaced', {
      instanceId: outcome.instanceId ?? '',
      sku: outcome.sku ?? ''
    }),
    [INTENT.change_finish]: t(language, 'finishSelected', {
      finishId: outcome.finishId ?? '',
      instanceId: outcome.instanceId ?? ''
    }),
    [INTENT.set_budget]: t(language, 'budgetSet', {
      budgetEur: intent.slots?.budgetEur ?? 0
    }),
    [INTENT.show_price]: t(language, 'priceCalculated')
  };

  return messages[intent.kind] ?? t(language, 'commandCompleted');
}
