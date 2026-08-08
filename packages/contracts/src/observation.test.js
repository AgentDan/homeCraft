import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BehaviorSignalInputSchema,
  BehaviorSignalSchema,
  ClientOutcomeInputSchema,
  DialogTurnSchema,
  OutcomeSchema
} from './index.js';

describe('observation contracts', () => {
  const base = {
    clientId: 'proj-1',
    ts: '2026-08-09T00:00:00.000Z',
    seq: 1
  };

  it('parses DialogTurn', () => {
    const turn = DialogTurnSchema.parse({
      ...base,
      speaker: 'client',
      text: 'hello'
    });
    assert.equal(turn.speaker, 'client');
  });

  it('parses BehaviorSignal and input without ts/seq', () => {
    const signal = BehaviorSignalSchema.parse({
      ...base,
      eventType: 'hover_long',
      targetId: 'candidate-1',
      durationMs: 2100
    });
    assert.equal(signal.eventType, 'hover_long');

    const input = BehaviorSignalInputSchema.parse({
      clientId: 'proj-1',
      eventType: 'click',
      targetId: 'candidate-1',
      durationMs: 0
    });
    assert.equal(input.eventType, 'click');
    assert.equal('ts' in input, false);
  });

  it('requires rejectionReason for reverted/abandoned clientOutcome', () => {
    assert.throws(() =>
      OutcomeSchema.parse({
        ...base,
        executionResult: { status: 'success', reason: null },
        clientOutcome: { status: 'abandoned', rejectionReason: null }
      })
    );
    assert.throws(() =>
      ClientOutcomeInputSchema.parse({
        clientId: 'proj-1',
        clientOutcome: { status: 'reverted', rejectionReason: '   ' }
      })
    );
    const ok = OutcomeSchema.parse({
      ...base,
      executionResult: { status: 'rejected', reason: 'overlap' },
      clientOutcome: { status: 'abandoned', rejectionReason: 'too expensive' }
    });
    assert.equal(ok.clientOutcome?.status, 'abandoned');
  });

  it('allows null clientOutcome on system-written Outcome', () => {
    const outcome = OutcomeSchema.parse({
      ...base,
      executionResult: { status: 'success', reason: null },
      clientOutcome: null
    });
    assert.equal(outcome.clientOutcome, null);
  });
});
