import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClientProfileSchema, DecisionStateSchema } from './index.js';

describe('decision-state contracts', () => {
  it('parses DecisionState with post_survey phase', () => {
    const state = DecisionStateSchema.parse({
      clientId: 'proj-1',
      phase: 'post_survey',
      journeyMode: 'guided',
      focusVariantIds: ['a'],
      rejectedIds: [{ variantId: 'b', reason: null }],
      topConcerns: ['rejection'],
      readinessScore: 0.8,
      lastSignals: []
    });
    assert.equal(state.phase, 'post_survey');
  });

  it('rejects readinessScore outside 0..1', () => {
    assert.throws(() =>
      DecisionStateSchema.parse({
        clientId: 'proj-1',
        readinessScore: 1.5
      })
    );
  });

  it('parses minimal ClientProfile', () => {
    const profile = ClientProfileSchema.parse({
      clientId: 'proj-1',
      emotionalDriver: null,
      valueWeights: {},
      budgetAnchor: null,
      segment: null
    });
    assert.equal(profile.clientId, 'proj-1');
  });
});
