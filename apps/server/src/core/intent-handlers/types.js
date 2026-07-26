/**
 * Shared JSDoc types for intent handlers. This module intentionally exports
 * no runtime values — it only carries typedefs referenced via `import('./types.js')`.
 *
 * Contract types are inferred from Zod schemas in `@homecraft/contracts`.
 * PlanOutcome is internal to the AI pipeline (not a contracts schema).
 */

/**
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').ClientRequestSchema>} ClientRequest
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').ClientResponseSchema>} ClientResponse
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').RoomContextSchema>} RoomContext
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').IntentResultSchema>} Intent
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').ConfigurationPlanSchema>} ConfigurationPlan
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').LanguageSchema>} Language
 * @typedef {import('zod').infer<typeof import('@homecraft/contracts').CommandOutcomeKindSchema>} OutcomeKind
 */

/**
 * Result of configuration-plan-generator for one command.
 * @typedef {Object} PlanOutcome
 * @property {'applied' | 'clarify' | 'read_only'} kind
 * @property {string} [prompt]
 * @property {string} [sku]
 * @property {string} [instanceId]
 * @property {string} [finishId]
 * @property {number} [addedCount]
 */

/**
 * @typedef {'respond' | 'continue'} HandlerResultKind
 *
 * 'respond'  — handler fully handled the command; ClientResponse is ready.
 * 'continue' — handler enriched context; route() continues on the shared path.
 */

/**
 * @typedef {Object} IntentHandlerInput
 * @property {ClientRequest} request
 * @property {RoomContext} context
 * @property {Intent} intent
 * @property {ConfigurationPlan} plan
 * @property {PlanOutcome} outcome
 * @property {Language} language
 */

/**
 * Handlers never call finalizeResponse — route() owns journal + idempotency writes.
 * createdVersion must stay exact: resultingVersionFor() uses it for the command journal.
 *
 * @typedef {Object} IntentHandlerResult
 * @property {HandlerResultKind} kind
 * @property {ClientResponse} [response]      Required when kind === 'respond'
 * @property {RoomContext} [context]          Updated context; if omitted, route keeps the input
 * @property {OutcomeKind} [outcomeKind]      Passed through to finalizeResponse as-is
 * @property {boolean} [createdVersion]       Passed through to finalizeResponse as-is
 */

export {};
