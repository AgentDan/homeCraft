import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJourneyAnswer,
  isFreeModeEscape,
  markQuestionAsked,
  nextQuestion,
  parseJourneyAnswer,
  parseRoomDimensionMm,
  ensureJourneyState
} from './journey-table.js';
import { routeJourneyDialog } from './dialog-router.js';
import { createDefaultJourneyState } from '@homecraft/contracts';

function baseRequest(command, language = 'en') {
  return {
    requestId: 'req-1',
    sessionId: 'sess-1',
    projectId: 'proj-1',
    command,
    language,
    expectedVersion: 0,
    inputChannel: 'text'
  };
}

function baseContext(journey) {
  return {
    projectId: 'proj-1',
    sessionId: 'sess-1',
    inputChannel: 'text',
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
    journey: journey ?? createDefaultJourneyState(),
    updatedAt: new Date().toISOString()
  };
}

describe('journey-table parsers', () => {
  it('parses room dimensions in m and mm', () => {
    assert.equal(parseRoomDimensionMm('3 m'), 3000);
    assert.equal(parseRoomDimensionMm('3000 mm'), 3000);
    assert.equal(parseRoomDimensionMm('4'), 4000);
    assert.equal(parseRoomDimensionMm('4500'), 4500);
    assert.equal(parseRoomDimensionMm('nope'), null);
  });

  it('detects free-mode escape phrases', () => {
    assert.equal(isFreeModeEscape('free mode'), true);
    assert.equal(isFreeModeEscape('работай свободно'), true);
    assert.equal(isFreeModeEscape('add base 600'), false);
  });

  it('advances stages 1→2→3→done', () => {
    let journey = ensureJourneyState();
    const q1 = nextQuestion(journey);
    assert.equal(q1?.id, 'clientName');
    journey = markQuestionAsked(journey, 'clientName');
    journey = applyJourneyAnswer(journey, 'clientName', 'Ada');
    assert.equal(journey.known.clientName, 'Ada');
    assert.equal(nextQuestion(journey)?.id, 'projectGoal');

    journey = markQuestionAsked(journey, 'projectGoal');
    journey = applyJourneyAnswer(journey, 'projectGoal', 'galley kitchen');
    assert.equal(nextQuestion(journey)?.id, 'roomWidthMm');

    journey = markQuestionAsked(journey, 'roomWidthMm');
    journey = applyJourneyAnswer(journey, 'roomWidthMm', 3000);
    journey = markQuestionAsked(journey, 'roomDepthMm');
    journey = applyJourneyAnswer(journey, 'roomDepthMm', 4000);
    assert.equal(journey.stage, 'done');
    assert.equal(nextQuestion(journey), null);
  });

  it('parseJourneyAnswer reads width from intent slots', () => {
    const parsed = parseJourneyAnswer('roomWidthMm', 'whatever', {
      slots: { roomWidthMm: 3200 }
    });
    assert.deepEqual(parsed, { ok: true, value: 3200 });
  });
});

describe('dialog-router', () => {
  it('asks the first guided question on unknown intent', async () => {
    const result = await routeJourneyDialog({
      request: baseRequest('hello'),
      context: baseContext(),
      intent: { kind: 'unknown', rawText: 'hello' },
      language: 'en'
    });
    assert.equal(result.handled, true);
    assert.match(result.response.message, /name/i);
    assert.equal(result.context.journey.pendingQuestionId, 'clientName');
  });

  it('does not block add_module commands', async () => {
    let journey = ensureJourneyState();
    journey = markQuestionAsked(journey, 'clientName');
    const result = await routeJourneyDialog({
      request: baseRequest('add base cabinet 600'),
      context: baseContext(journey),
      intent: { kind: 'add_module', slots: { sku: 'BASE-600' } },
      language: 'en'
    });
    assert.equal(result.handled, false);
    assert.equal(result.context.journey.pendingQuestionId, 'clientName');
  });

  it('switches to free mode on escape phrase', async () => {
    const result = await routeJourneyDialog({
      request: baseRequest('free mode'),
      context: baseContext(),
      intent: { kind: 'unknown', rawText: 'free mode' },
      language: 'en'
    });
    assert.equal(result.handled, true);
    assert.equal(result.context.journey.mode, 'free');
    assert.match(result.response.message, /free mode/i);
  });

  it('fills a pending slot and asks the next question', async () => {
    let journey = ensureJourneyState();
    journey = markQuestionAsked(journey, 'clientName');
    const result = await routeJourneyDialog({
      request: baseRequest('Maria'),
      context: baseContext(journey),
      intent: { kind: 'unknown', rawText: 'Maria' },
      language: 'en'
    });
    assert.equal(result.handled, true);
    assert.equal(result.context.journey.known.clientName, 'Maria');
    assert.equal(result.context.journey.pendingQuestionId, 'projectGoal');
    assert.match(result.response.message, /kitchen/i);
  });

  it('writes room depth into roomShape on survey answer', async () => {
    let journey = ensureJourneyState();
    journey = applyJourneyAnswer(
      applyJourneyAnswer(
        applyJourneyAnswer(
          markQuestionAsked(journey, 'clientName'),
          'clientName',
          'A'
        ),
        'projectGoal',
        'goal'
      ),
      'roomWidthMm',
      3000
    );
    journey = markQuestionAsked(journey, 'roomDepthMm');
    const result = await routeJourneyDialog({
      request: baseRequest('4 m'),
      context: baseContext(journey),
      intent: { kind: 'unknown', rawText: '4 m' },
      language: 'en'
    });
    assert.equal(result.context.roomShape.dimensions.depthMm, 4000);
    assert.equal(result.context.journey.stage, 'done');
  });
});
