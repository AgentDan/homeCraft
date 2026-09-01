/**
 * DP4 recommendation_rules engine (Ф3 MVP).
 * Forms ConfigurationIntent → generatePlan → assertCompatible → calculateBOM.
 * Dialogue Action and Configuration Action are separate; config only after assertCompatible.
 */
import {
  ConfigurationIntentSchema,
  RecommendationRuleTableSchema,
  CommandOutcomeKindSchema,
  registry
} from '@homecraft/contracts';
import { generatePlan } from '../ai-services/configuration-plan-generator.js';
import { runPipeline as runKitchenPipeline } from '../domain-modules/kitchen/pipeline.js';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';
import {
  appendPlanVersion,
  getActiveBranchMeta
} from '../storage/local-storage.js';
import {
  buildClarifyResponse,
  buildOutput,
  buildChangeSummary
} from './output-builder.js';
import {
  createDefaultDecisionState,
  loadClientProfile,
  loadDecisionState,
  updateDecisionStateFromEventSafe
} from './decision-state.js';
import { t } from '../i18n/messages.js';
import { logPipelineDiff, snapshotPlanId } from '../lib/diffLog.js';

const OUTCOME = CommandOutcomeKindSchema.enum;

/** Last-resort default for callers that omit productType — production call sites pass it. */
const DEFAULT_PRODUCT_TYPE = 'kitchen';

/** @type {Map<string, import('zod').infer<typeof import('@homecraft/contracts').RecommendationRuleSchema>[]>} */
const activeRulesByDomain = new Map();

/**
 * @param {string} productType
 * @param {import('zod').infer<typeof import('@homecraft/contracts').RecommendationRuleSchema>[]} rules
 */
export function replaceRecommendationRules(productType, rules) {
  const parsed = RecommendationRuleTableSchema.parse(rules);
  activeRulesByDomain.set(productType, parsed);
  return parsed;
}

/**
 * @param {string} [productType]
 */
export function getRecommendationRules(productType = DEFAULT_PRODUCT_TYPE) {
  return activeRulesByDomain.get(productType) ?? [];
}

/**
 * @param {Record<string, unknown>} ctx
 * @param {string} fieldPath
 */
export function getContextField(ctx, fieldPath) {
  const parts = fieldPath.split('.');
  let current = /** @type {unknown} */ (ctx);
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = /** @type {Record<string, unknown>} */ (current)[part];
  }
  return current;
}

/**
 * @param {import('zod').infer<typeof import('@homecraft/contracts').AtomicConditionSchema>} condition
 * @param {Record<string, unknown>} ctx
 */
export function matchAtomicCondition(condition, ctx) {
  const actual = getContextField(ctx, condition.field);
  const { operator, value } = condition;

  if (operator === 'exists') {
    const present =
      actual !== undefined
      && actual !== null
      && actual !== ''
      && !(Array.isArray(actual) && actual.length === 0);
    return value === false ? !present : present;
  }
  if (operator === 'equals') return actual === value;
  if (operator === 'not_equals') return actual !== value;
  if (operator === 'in') {
    return Array.isArray(value) && value.includes(/** @type {string} */ (actual));
  }
  if (operator === 'not_in') {
    return Array.isArray(value) && !value.includes(/** @type {string} */ (actual));
  }
  if (typeof actual === 'number' && typeof value === 'number') {
    if (operator === 'gt') return actual > value;
    if (operator === 'gte') return actual >= value;
    if (operator === 'lt') return actual < value;
    if (operator === 'lte') return actual <= value;
  }
  return false;
}

/**
 * @param {import('zod').infer<typeof import('@homecraft/contracts').ConditionSchema>} condition
 * @param {Record<string, unknown>} ctx
 */
export function matchCondition(condition, ctx) {
  if ('always' in condition && condition.always === true) return true;
  if ('allOf' in condition) {
    return condition.allOf.every((item) => matchAtomicCondition(item, ctx));
  }
  if ('anyOf' in condition) {
    return condition.anyOf.some((item) => matchAtomicCondition(item, ctx));
  }
  return matchAtomicCondition(
    /** @type {import('zod').infer<typeof import('@homecraft/contracts').AtomicConditionSchema>} */ (
      condition
    ),
    ctx
  );
}

/**
 * @param {Record<string, unknown>} ctx
 * @param {string | import('zod').infer<typeof import('@homecraft/contracts').RecommendationRuleSchema>[]} [productTypeOrRules]
 */
export function evaluateRecommendationRules(ctx, productTypeOrRules = DEFAULT_PRODUCT_TYPE) {
  const rules = Array.isArray(productTypeOrRules)
    ? productTypeOrRules
    : getRecommendationRules(productTypeOrRules);
  const matching = rules
    .filter((rule) => rule.active && matchCondition(rule.condition, ctx))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.ruleId.localeCompare(b.ruleId);
    });

  /** @type {Record<string, string>} */
  const filters = {};
  /** @type {Record<string, { ruleId: string, priority: number }>} */
  const filterOwners = {};
  /** @type {string[]} */
  const dialogueTopics = [];
  /** @type {Record<string, { ruleId: string, priority: number }>} */
  const topicOwners = {};
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const appliedRuleIds = [];

  for (const rule of matching) {
    appliedRuleIds.push(rule.ruleId);
    if (rule.action.type === 'filterCatalog') {
      for (const [key, value] of Object.entries(rule.action.filters)) {
        const existing = filterOwners[key];
        if (!existing) {
          filters[key] = value;
          filterOwners[key] = { ruleId: rule.ruleId, priority: rule.priority };
          continue;
        }
        if (existing.priority === rule.priority && existing.ruleId !== rule.ruleId) {
          const winner =
            existing.ruleId < rule.ruleId ? existing.ruleId : rule.ruleId;
          const warning =
            `[dp4] filterCatalog.${key} tie at priority ${rule.priority}: `
            + `${existing.ruleId} vs ${rule.ruleId}; keeping ${winner}`;
          warnings.push(warning);
          console.warn(warning);
          if (rule.ruleId < existing.ruleId) {
            filters[key] = value;
            filterOwners[key] = { ruleId: rule.ruleId, priority: rule.priority };
          }
        }
        // higher-priority owner already set — skip
      }
    } else if (rule.action.type === 'triggerDialogueAction') {
      const key = 'topic';
      const existing = topicOwners[key];
      if (!existing) {
        dialogueTopics.push(rule.action.topic);
        topicOwners[key] = { ruleId: rule.ruleId, priority: rule.priority };
      } else if (
        existing.priority === rule.priority
        && existing.ruleId !== rule.ruleId
      ) {
        const winner =
          existing.ruleId < rule.ruleId ? existing.ruleId : rule.ruleId;
        const warning =
          `[dp4] triggerDialogueAction tie at priority ${rule.priority}: `
          + `${existing.ruleId} vs ${rule.ruleId}; keeping ${winner}`;
        warnings.push(warning);
        console.warn(warning);
        if (rule.ruleId < existing.ruleId) {
          dialogueTopics[0] = rule.action.topic;
          topicOwners[key] = { ruleId: rule.ruleId, priority: rule.priority };
        }
      } else if (existing.priority < rule.priority) {
        // allow additional lower-priority topics as alternatives in speech
        if (!dialogueTopics.includes(rule.action.topic)) {
          dialogueTopics.push(rule.action.topic);
        }
      }
    }
  }

  // Always append alternative topic when that rule matched (even if primary topic set)
  const altRule = matching.find(
    (rule) => rule.ruleId === 'conflicting_behavior_becomes_alternative'
  );
  if (
    altRule
    && altRule.action.type === 'triggerDialogueAction'
    && !dialogueTopics.includes(altRule.action.topic)
  ) {
    dialogueTopics.push(altRule.action.topic);
  }

  return {
    filters,
    dialogueTopics,
    appliedRuleIds,
    warnings,
    matching
  };
}

/**
 * Map known survey answers → catalog slots (deterministic; no LLM).
 * @param {Record<string, string>} filters
 * @param {Record<string, unknown>} known
 * @param {{
 *   defaultSku?: string,
 *   defaultCategory?: string,
 *   byFacade?: Record<string, string>,
 *   lowBudgetSku?: string,
 *   lowBudgetEur?: number
 * } | null | undefined} dp4SkuMap
 */
export function resolveCatalogSlotsFromFilters(filters, known, dp4SkuMap) {
  /** @type {Record<string, string | number>} */
  const slots = {};
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'preferFrom' || key === 'source' || key === 'role') continue;
    // sku from lower-priority default must not override known mapping
    if (key === 'sku' && filters.preferFrom === 'known') continue;
    slots[key] = value;
  }

  const map = dp4SkuMap ?? {};
  if (filters.preferFrom === 'known') {
    const facade = known.facadeMaterialPreference;
    if (facade && map.byFacade?.[/** @type {string} */ (facade)]) {
      slots.sku = map.byFacade[/** @type {string} */ (facade)];
    }

    const budget = known.budgetEur;
    if (typeof budget === 'number' && map.lowBudgetEur != null && budget < map.lowBudgetEur) {
      slots.sku = map.lowBudgetSku;
    }
    if (!slots.sku) slots.sku = map.defaultSku;
    if (!slots.category) slots.category = map.defaultCategory;
  }

  if (!slots.sku && filters.sku) slots.sku = filters.sku;
  if (!slots.category && filters.category) slots.category = filters.category;
  if (!slots.sku) slots.sku = map.defaultSku;

  return slots;
}

/**
 * @param {ReturnType<typeof evaluateRecommendationRules>} decision
 * @param {{
 *   known: Record<string, unknown>,
 *   decisionState: import('zod').infer<typeof import('@homecraft/contracts').DecisionStateSchema>,
 *   language: string,
 *   dp4SkuMap?: {
 *     defaultSku?: string,
 *     defaultCategory?: string,
 *     byFacade?: Record<string, string>,
 *     lowBudgetSku?: string,
 *     lowBudgetEur?: number
 *   } | null
 * }} ctx
 */
export function buildConfigurationIntent(decision, ctx) {
  const slots = resolveCatalogSlotsFromFilters(decision.filters, ctx.known, ctx.dp4SkuMap);
  const primarySku = typeof slots.sku === 'string' && slots.sku
    ? String(slots.sku)
    : undefined;
  const rejected = new Set(
    (ctx.decisionState.rejectedIds ?? []).map((entry) => entry.variantId)
  );
  const alternativeSkus = (ctx.decisionState.focusVariantIds ?? []).filter(
    (id) => id !== primarySku && !rejected.has(id)
  );

  return ConfigurationIntentSchema.parse({
    kind: 'add_module',
    confidence: 1,
    language: ctx.language,
    rawText: '[dp4]',
    slots,
    source: 'dp4',
    primarySku,
    alternativeSkus,
    dialogueTopic: decision.dialogueTopics[0]
  });
}

/**
 * Dialogue Action — speech from DP4 topics (no LLM choice of variant).
 * @param {string[]} topics
 * @param {{ primarySku?: string, alternativeSkus?: string[] }} intent
 * @param {import('../i18n/messages.js').Language} language
 * @param {{ defaultSku?: string } | null | undefined} [dp4SkuMap]
 */
export function buildDialogueSpeech(topics, intent, language, dp4SkuMap) {
  const sku = intent.primarySku ?? dp4SkuMap?.defaultSku;
  const alts = intent.alternativeSkus ?? [];
  const parts = [t(language, 'dp4PrimaryRecommendation', { sku })];

  if (topics.includes('behavior_as_alternative') && alts.length > 0) {
    parts.push(
      t(language, 'dp4BehaviorAlternative', {
        alts: alts.join(', ')
      })
    );
  }

  return parts.join(' ');
}

/**
 * @param {{ command?: string, clientState?: Record<string, unknown> }} request
 * @param {{ kind?: string }} intent
 * @param {{ stage?: string } | null | undefined} journey
 */
export function shouldTriggerDp4(request, intent, journey) {
  if (journey?.stage !== 'done') return false;
  if (request.clientState?.dp4 === true) return true;
  const text = String(request.command ?? '').trim();
  return (
    /\brecommend\b/i.test(text)
    || /\bsuggest\b/i.test(text)
    || /предлож/i.test(text)
    || /рекоменд/i.test(text)
    || /preporu[cč]i/i.test(text)
    || /predlo[zž]i/i.test(text)
  );
}

/**
 * Full DP4 → plan → assertCompatible → calculateBOM path.
 * @param {{
 *   request: import('zod').infer<typeof import('@homecraft/contracts').ClientRequestSchema>,
 *   context: import('zod').infer<typeof import('@homecraft/contracts').RoomContextSchema>,
 *   language: import('../i18n/messages.js').Language
 * }} input
 */
export async function runDp4Recommendation({ request, context, language }) {
  const productType = context.productType ?? DEFAULT_PRODUCT_TYPE;
  const manifest = registry.get(productType);
  const dp4SkuMap = manifest.dp4SkuMap;
  const clientId = request.projectId;
  const journey = context.journey;
  await updateDecisionStateFromEventSafe(clientId, null, {
    journey: journey
      ? { stage: journey.stage, mode: journey.mode }
      : undefined
  });

  const decisionState =
    (await loadDecisionState(clientId))
    ?? createDefaultDecisionState(clientId);
  const clientProfile = await loadClientProfile(clientId);

  const ruleCtx = {
    known: journey?.known ?? {},
    decisionState,
    clientProfile: clientProfile ?? {},
    phase:
      journey?.stage === 'done' || decisionState.phase === 'post_survey'
        ? 'post_survey'
        : decisionState.phase
  };

  const decision = evaluateRecommendationRules(ruleCtx, productType);

  // Domains without a catalog SKU map (desk today) skip configuration — no kitchen SKU invented.
  if (!dp4SkuMap) {
    return {
      context,
      response: buildClarifyResponse(
        request,
        t(language, 'clarifyAddModule'),
        context.planVersion
      ),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false,
      decision
    };
  }

  const configIntent = buildConfigurationIntent(decision, {
    known: ruleCtx.known,
    decisionState,
    language,
    dp4SkuMap
  });

  // Dialogue Action — can leave immediately (message ready before config gate).
  const dialogueSpeech = buildDialogueSpeech(
    decision.dialogueTopics,
    configIntent,
    language,
    dp4SkuMap
  );

  const snapshot = await getCatalogSnapshot(context.catalogSnapshotId, productType);
  const candidates = snapshot?.modules ?? [];

  const { plan, outcome } = await generatePlan({
    intent: configIntent,
    context,
    dialogText: request.command,
    candidates,
    platformRules: []
  });

  if (outcome.kind === 'clarify') {
    return {
      context,
      response: buildClarifyResponse(
        request,
        `${dialogueSpeech} ${outcome.prompt}`,
        context.planVersion
      ),
      outcomeKind: OUTCOME.clarify,
      createdVersion: false,
      dialogueSpeech,
      decision
    };
  }

  // Configuration Action — only after positive assertCompatible.
  const compatibility = await manifest.assertCompatible(plan, context);
  if (!compatibility.valid) {
    const reason =
      compatibility.conflicts?.[0]?.message ?? 'compatibility_rejected';
    return {
      context,
      response: buildClarifyResponse(
        request,
        t(language, 'dp4ConfigRejected', {
          speech: dialogueSpeech,
          reason
        }),
        context.planVersion
      ),
      outcomeKind: OUTCOME.rejected,
      createdVersion: false,
      dialogueSpeech,
      decision,
      compatibility
    };
  }

  const bom = await manifest.calculateBOM(plan, plan.catalogSnapshotId);
  logPipelineDiff(request, 'Ядро', snapshotPlanId(plan, context), {
    'compatResult.valid': compatibility?.valid,
    'compatResult.conflicts': compatibility?.conflicts,
    'compatResult.suggestedSkus': (compatibility?.conflicts ?? []).flatMap(
      (conflict) => conflict.suggestedSkus ?? []
    ),
    'bom.lines': bom?.lines,
    'bom.totalWithVat': bom?.totalEur
  });
  const scene = await runKitchenPipeline(plan, context);
  const versionEntry = await appendPlanVersion(
    request.sessionId,
    request.projectId,
    plan,
    request.requestId,
    request.expectedVersion
  );
  const branchMeta = await getActiveBranchMeta(
    request.sessionId,
    request.projectId
  );

  const message = t(language, 'dp4ConfigApplied', {
    speech: dialogueSpeech,
    sku: configIntent.primarySku ?? dp4SkuMap.defaultSku,
    totalEur: bom.totalEur
  });

  const response = buildOutput({
    request,
    plan,
    scene,
    bom,
    compatibility,
    roomShape: context.roomShape,
    budgetEur:
      typeof journey?.known?.budgetEur === 'number'
        ? journey.known.budgetEur
        : context.budgetEur ?? null,
    message,
    speech: dialogueSpeech,
    intentKind: 'add_module',
    planVersion: versionEntry.version,
    branchId: branchMeta?.branchId,
    branchName: branchMeta?.branchName,
    changeSummary: buildChangeSummary(plan, message, {
      sinceOperationCount: context.planOperations?.length ?? 0
    }),
    view: { kind: '3d_scene', render: 'full' }
  });

  return {
    context: {
      ...context,
      planOperations: structuredClone(plan.operations),
      planVersion: versionEntry.version,
      budgetEur:
        typeof journey?.known?.budgetEur === 'number'
          ? journey.known.budgetEur
          : context.budgetEur
    },
    response,
    outcomeKind: OUTCOME.applied,
    createdVersion: true,
    dialogueSpeech,
    decision,
    configurationIntent: configIntent
  };
}
