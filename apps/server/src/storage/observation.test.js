import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('observation timeline', () => {
  /** @type {string} */
  let storageRoot;
  /** @type {typeof import('./journey-events.js')} */
  let observation;

  before(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-obs-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    observation = await import('./journey-events.js');
  });

  after(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('merges journey + dialog + signal + outcome sorted by ts/seq', async () => {
    const clientId = `proj-obs-${Date.now()}`;

    await observation.appendJourneyEvent({
      type: 'stage_enter',
      projectId: clientId,
      sessionId: 'sess-1',
      stage: 'intro'
    });
    await observation.appendDialogTurnEvent({
      clientId,
      speaker: 'client',
      text: 'Anna'
    });
    await observation.appendDialogTurnEvent({
      clientId,
      speaker: 'agent',
      text: 'What is the goal?'
    });
    await observation.appendBehaviorSignal({
      clientId,
      eventType: 'click',
      targetId: 'candidate-1',
      durationMs: 0,
      // client-supplied ts must be ignored
      ts: '2000-01-01T00:00:00.000Z',
      seq: 999
    });
    await observation.appendOutcomeEvent({
      clientId,
      requestId: 'req-1',
      executionResult: { status: 'success', reason: null },
      clientOutcome: null
    });
    await observation.appendOutcomeEvent({
      clientId,
      requestId: 'req-1',
      executionResult: { status: 'success', reason: null },
      clientOutcome: {
        status: 'accepted',
        rejectionReason: null
      }
    });

    const timeline = await observation.loadObservationTimeline(clientId);
    assert.equal(timeline.length, 6);

    const kinds = timeline.map((event) => event.kind);
    assert.deepEqual(kinds, [
      'journey_event',
      'dialog_turn',
      'dialog_turn',
      'behavior_signal',
      'outcome',
      'outcome'
    ]);

    for (let i = 1; i < timeline.length; i += 1) {
      const prev = timeline[i - 1];
      const cur = timeline[i];
      const tsA = String(prev.ts ?? '');
      const tsB = String(cur.ts ?? '');
      assert.ok(tsA <= tsB);
      if (tsA === tsB) {
        assert.ok(Number(prev.seq) < Number(cur.seq));
      }
    }

    const signal = timeline.find((event) => event.kind === 'behavior_signal');
    assert.ok(signal);
    assert.notEqual(signal.ts, '2000-01-01T00:00:00.000Z');
    assert.notEqual(signal.seq, 999);
    assert.equal(signal.clientId, clientId);

    const journey = timeline.find((event) => event.kind === 'journey_event');
    assert.equal(journey?.type, 'stage_enter');
    assert.equal(journey?.clientId, clientId);
    assert.ok(typeof journey?.ts === 'string');
  });
});
