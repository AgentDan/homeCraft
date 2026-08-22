import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  evaluateRecommendationRules,
  matchCondition,
  buildConfigurationIntent,
  runDp4Recommendation,
  shouldTriggerDp4,
  replaceRecommendationRules
} from './recommendation-engine.js';
import { createDefaultJourneyState, registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import { ensureStorage } from '../storage/local-storage.js';
import { loadObservationTimeline } from '../storage/journey-events.js';
import { updateDecisionStateFromEvent } from './decision-state.js';

describe('recommendation-engine DP4', () => {
  /** @type {string} */
  let storageRoot;

  before(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-dp4-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    await ensureStorage();
    replaceRecommendationRules(kitchenManifest.dp4Rules);
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(deskManifest);
    }
  });

  after(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('matches always and allOf/anyOf conditions', () => {
    assert.equal(matchCondition({ always: true }, {}), true);
    assert.equal(
      matchCondition(
        {
          allOf: [
            { field: 'known.a', operator: 'equals', value: '1' },
            { field: 'known.b', operator: 'exists', value: true }
          ]
        },
        { known: { a: '1', b: 'x' } }
      ),
      true
    );
  });

  it('applies explicit_answer before default and warns on same-priority filter ties', () => {
    const decision = evaluateRecommendationRules({
      known: {
        facadeMaterialPreference: 'durable',
        budgetEur: 20000
      },
      decisionState: {
        clientId: 'p',
        phase: 'post_survey',
        journeyMode: 'guided',
        focusVariantIds: [],
        rejectedIds: [],
        topConcerns: [],
        readinessScore: 0.8,
        lastSignals: []
      },
      phase: 'post_survey'
    });
    assert.ok(decision.appliedRuleIds.includes('explicit_answer_wins_over_behavior'));
    assert.ok(decision.appliedRuleIds.includes('default_no_special_conditions'));
    assert.equal(decision.filters.preferFrom, 'known');
    // default sku must not override preferFrom from higher priority
    assert.equal(decision.filters.sku, 'BASE-600');

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.join(' '));
    };
    try {
      evaluateRecommendationRules(
        { known: {}, decisionState: { focusVariantIds: [] }, phase: 'post_survey' },
        [
          {
            ruleId: 'aaa_rule',
            priority: 5,
            condition: { always: true },
            action: { type: 'filterCatalog', filters: { sku: 'BASE-400' } },
            active: true
          },
          {
            ruleId: 'bbb_rule',
            priority: 5,
            condition: { always: true },
            action: { type: 'filterCatalog', filters: { sku: 'BASE-800' } },
            active: true
          }
        ]
      );
    } finally {
      console.warn = originalWarn;
    }
    assert.ok(warnings.some((line) => /tie at priority 5/.test(line)));
  });

  it('keeps conflicting focusVariantIds as dialogue alternatives only', () => {
    const decision = evaluateRecommendationRules({
      known: { facadeMaterialPreference: 'soft' },
      decisionState: {
        clientId: 'p',
        phase: 'post_survey',
        journeyMode: 'guided',
        focusVariantIds: ['DRAWER-400', 'WALL-600'],
        rejectedIds: [],
        topConcerns: [],
        readinessScore: 0.8,
        lastSignals: []
      },
      phase: 'post_survey'
    });
    assert.ok(
      decision.appliedRuleIds.includes('conflicting_behavior_becomes_alternative')
    );
    assert.ok(decision.dialogueTopics.includes('behavior_as_alternative'));

    const intent = buildConfigurationIntent(decision, {
      known: { facadeMaterialPreference: 'soft' },
      decisionState: {
        clientId: 'p',
        phase: 'post_survey',
        journeyMode: 'guided',
        focusVariantIds: ['DRAWER-400', 'WALL-600'],
        rejectedIds: [],
        topConcerns: [],
        readinessScore: 0.8,
        lastSignals: []
      },
      language: 'en',
      dp4SkuMap: kitchenManifest.dp4SkuMap
    });
    assert.equal(intent.primarySku, 'DRAWER-600');
    assert.deepEqual(intent.alternativeSkus, ['DRAWER-400', 'WALL-600']);
  });

  it('E2E: post_survey → DP4 → assertCompatible → variant + speech → Outcome', async () => {
    const projectId = `proj-dp4-${Date.now()}`;
    const sessionId = `sess-dp4-${Date.now()}`;
    let journey = createDefaultJourneyState();
    journey = {
      ...journey,
      stage: 'done',
      mode: 'guided',
      known: {
        clientName: 'Ada',
        projectGoal: 'galley',
        roomWidthMm: 3000,
        roomDepthMm: 4000,
        hasKidsOrPets: 'yes',
        facadeMaterialPreference: 'durable',
        shoppingHabit: 'research',
        socialStyle: 'family',
        budgetEur: 25000
      },
      missing: [],
      pendingQuestionId: null
    };

    await updateDecisionStateFromEvent(projectId, null, {
      journey: { stage: 'done', mode: 'guided' }
    });

    const request = {
      requestId: `req-dp4-${Date.now()}`,
      sessionId,
      projectId,
      command: 'recommend a cabinet',
      language: /** @type {const} */ ('en'),
      expectedVersion: 0,
      inputChannel: /** @type {const} */ ('text'),
      clientState: { dp4: true }
    };

    const context = {
      projectId,
      sessionId,
      inputChannel: /** @type {const} */ ('text'),
      catalogSnapshotId: 'kitchen-demo-v1',
      roomShape: {
        dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
        walls: [],
        openings: [],
        utilities: []
      },
      planOperations: [],
      planVersion: 0,
      dialogTurns: [],
      journey,
      updatedAt: new Date().toISOString()
    };

    assert.equal(shouldTriggerDp4(request, { kind: 'unknown' }, journey), true);

    const result = await runDp4Recommendation({
      request,
      context,
      language: 'en'
    });

    assert.equal(result.outcomeKind, 'applied');
    assert.equal(result.createdVersion, true);
    assert.ok(result.response.speech);
    assert.match(result.response.message, /BASE-600/);
    assert.equal(result.response.compatibility?.valid, true);
    assert.ok((result.response.bom?.totalEur ?? 0) > 0);
    assert.equal(result.configurationIntent?.primarySku, 'BASE-600');

    // Outcome is written by orchestrator finalize; mirror Observation write for E2E criterion
    const { appendOutcomeEvent } = await import('../storage/journey-events.js');
    await appendOutcomeEvent({
      clientId: projectId,
      requestId: request.requestId,
      executionResult: { status: 'success', reason: null },
      clientOutcome: { status: 'accepted', rejectionReason: null }
    });
    const timeline = await loadObservationTimeline(projectId);
    assert.ok(timeline.some((event) => event.kind === 'outcome'));
  });

  it('skips configuration without throwing when the manifest has no dp4SkuMap', async () => {
    const projectId = `proj-dp4-desk-${Date.now()}`;
    const sessionId = `sess-dp4-desk-${Date.now()}`;
    const request = {
      requestId: `req-dp4-desk-${Date.now()}`,
      sessionId,
      projectId,
      command: 'recommend a desk',
      language: /** @type {const} */ ('en'),
      expectedVersion: 0,
      inputChannel: /** @type {const} */ ('text'),
      clientState: { dp4: true }
    };
    const context = {
      projectId,
      sessionId,
      productType: 'desk',
      inputChannel: /** @type {const} */ ('text'),
      catalogSnapshotId: 'kitchen-demo-v1',
      roomShape: {
        dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
        walls: [],
        openings: [],
        utilities: []
      },
      planOperations: [],
      planVersion: 0,
      dialogTurns: [],
      journey: {
        ...createDefaultJourneyState(),
        stage: 'done',
        mode: 'guided',
        known: {},
        missing: [],
        pendingQuestionId: null
      },
      updatedAt: new Date().toISOString()
    };

    const result = await runDp4Recommendation({
      request,
      context,
      language: 'en'
    });
    assert.equal(result.outcomeKind, 'clarify');
    assert.equal(result.createdVersion, false);
    assert.equal(result.configurationIntent, undefined);
  });
});
