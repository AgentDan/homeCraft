import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  HOVER_LONG_FOCUS_MS,
  createDefaultDecisionState,
  phaseFromJourneyStage,
  recalculateDecisionState,
  updateDecisionStateFromEvent,
  saveClientProfile,
  loadClientProfile
} from './decision-state.js';
import { appendJourneyEvent, appendBehaviorSignal } from '../storage/journey-events.js';

describe('decision-state v0', () => {
  /** @type {string} */
  let storageRoot;

  before(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-ds-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
  });

  after(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('maps journey.stage done → post_survey outside the router', () => {
    assert.equal(phaseFromJourneyStage('done'), 'post_survey');
    assert.equal(phaseFromJourneyStage('survey'), 'survey');
    const state = recalculateDecisionState(
      createDefaultDecisionState('proj-1'),
      null,
      { journey: { stage: 'done', mode: 'guided' } }
    );
    assert.equal(state.phase, 'post_survey');
    assert.equal(state.journeyMode, 'guided');
    assert.ok(state.readinessScore >= 0.75);
  });

  it('adds hover_long > 20s to focusVariantIds and reject_variant to rejectedIds', () => {
    let state = createDefaultDecisionState('proj-2');
    state = recalculateDecisionState(state, {
      kind: 'behavior_signal',
      clientId: 'proj-2',
      ts: '2026-08-09T00:00:00.000Z',
      seq: 1,
      eventType: 'hover_long',
      targetId: 'candidate-1',
      durationMs: HOVER_LONG_FOCUS_MS
    });
    assert.deepEqual(state.focusVariantIds, []);

    state = recalculateDecisionState(state, {
      kind: 'behavior_signal',
      clientId: 'proj-2',
      ts: '2026-08-09T00:00:01.000Z',
      seq: 2,
      eventType: 'hover_long',
      targetId: 'candidate-1',
      durationMs: HOVER_LONG_FOCUS_MS + 1
    });
    assert.deepEqual(state.focusVariantIds, ['candidate-1']);

    state = recalculateDecisionState(state, {
      kind: 'behavior_signal',
      clientId: 'proj-2',
      ts: '2026-08-09T00:00:02.000Z',
      seq: 3,
      eventType: 'reject_variant',
      targetId: 'candidate-2',
      durationMs: 0
    });
    assert.deepEqual(state.rejectedIds, [
      { variantId: 'candidate-2', reason: null }
    ]);
    assert.ok(state.topConcerns.includes('rejection'));
    assert.equal(state.lastSignals.length, 3);
  });

  it('persists post_survey after journey stage_enter done event', async () => {
    const clientId = `proj-ds-done-${Date.now()}`;
    await appendJourneyEvent({
      type: 'stage_enter',
      projectId: clientId,
      sessionId: 'sess-1',
      stage: 'done'
    });
    const state = await updateDecisionStateFromEvent(clientId, null, {
      journey: { stage: 'done', mode: 'guided' }
    });
    assert.equal(state?.phase, 'post_survey');
  });

  it('updates DecisionState when BehaviorSignal is recorded', async () => {
    const clientId = `proj-ds-sig-${Date.now()}`;
    await appendBehaviorSignal({
      clientId,
      eventType: 'hover_long',
      targetId: 'opt-a',
      durationMs: 25_000
    });
    const { loadDecisionState } = await import('./decision-state.js');
    const state = await loadDecisionState(clientId);
    assert.ok(state);
    assert.ok(state.focusVariantIds.includes('opt-a'));
  });

  it('stores ClientProfile manually without dialog inference', async () => {
    const clientId = `proj-profile-${Date.now()}`;
    const saved = await saveClientProfile({
      clientId,
      emotionalDriver: 'calm_control',
      valueWeights: { durability: 0.7, price: 0.3 },
      budgetAnchor: 12000,
      segment: 'family'
    });
    assert.equal(saved.emotionalDriver, 'calm_control');
    const loaded = await loadClientProfile(clientId);
    assert.equal(loaded?.segment, 'family');
    assert.equal(loaded?.budgetAnchor, 12000);
  });
});
