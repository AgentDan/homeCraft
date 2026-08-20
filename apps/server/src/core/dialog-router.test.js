import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import {
  applyJourneyAnswer,
  isFreeModeEscape,
  markQuestionAsked,
  nextQuestion,
  parseJourneyAnswer,
  parseRoomDimensionMm,
  ensureJourneyState,
  validateAnswer,
  replaceJourneyQuestions
} from './journey-table.js';
import { routeJourneyDialog } from './dialog-router.js';
import { createDefaultJourneyState } from '@homecraft/contracts';

before(() => {
  replaceJourneyQuestions(kitchenManifest.journeyQuestions);
});

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

/**
 * Fill the original four slots so later tests start at the new survey questions.
 * @param {ReturnType<typeof ensureJourneyState>} journey
 */
function fillLegacyFour(journey) {
  let next = journey;
  next = applyJourneyAnswer(markQuestionAsked(next, 'clientName'), 'clientName', 'A');
  next = applyJourneyAnswer(next, 'projectGoal', 'goal');
  next = applyJourneyAnswer(next, 'roomWidthMm', 3000);
  next = applyJourneyAnswer(next, 'roomDepthMm', 4000);
  return next;
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

  it('advances stages through legacy four then new survey slots', () => {
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
    assert.equal(nextQuestion(journey)?.id, 'hasKidsOrPets');
    assert.notEqual(journey.stage, 'done');
  });

  it('parseJourneyAnswer reads width from intent slots', () => {
    const parsed = parseJourneyAnswer('roomWidthMm', 'whatever', {
      slots: { roomWidthMm: 3200 }
    });
    assert.deepEqual(parsed, { ok: true, value: 3200 });
  });

  it('validateAnswer dispatches by validation.type', () => {
    assert.deepEqual(
      validateAnswer('Maria', null, {
        type: 'text',
        minLength: 1,
        maxLength: 80,
        rejectIfNumeric: true
      }),
      { ok: true, value: 'Maria' }
    );
    assert.equal(
      validateAnswer('3000', null, {
        type: 'text',
        minLength: 1,
        maxLength: 80,
        rejectIfNumeric: true
      }).ok,
      false
    );
    assert.deepEqual(
      validateAnswer('15000', null, {
        type: 'number',
        min: 100,
        max: 1_000_000,
        integer: true
      }),
      { ok: true, value: 15000 }
    );
    assert.deepEqual(
      validateAnswer('да', null, { type: 'enum', options: ['yes', 'no'] }),
      { ok: true, value: 'yes' }
    );
  });

  it('skips facadeMaterialPreference when hasKidsOrPets is no', () => {
    let journey = fillLegacyFour(ensureJourneyState());
    assert.equal(nextQuestion(journey)?.id, 'hasKidsOrPets');
    journey = applyJourneyAnswer(
      markQuestionAsked(journey, 'hasKidsOrPets'),
      'hasKidsOrPets',
      'no'
    );
    assert.equal(nextQuestion(journey)?.id, 'shoppingHabit');
    assert.equal(journey.known.facadeMaterialPreference, undefined);
    assert.ok(!journey.missing.includes('facadeMaterialPreference'));
  });

  it('asks facadeMaterialPreference when hasKidsOrPets is yes', () => {
    let journey = fillLegacyFour(ensureJourneyState());
    journey = applyJourneyAnswer(
      markQuestionAsked(journey, 'hasKidsOrPets'),
      'hasKidsOrPets',
      'yes'
    );
    assert.equal(nextQuestion(journey)?.id, 'facadeMaterialPreference');
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

  it('writes room depth into roomShape and continues survey', async () => {
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
    assert.equal(result.context.journey.known.roomDepthMm, 4000);
    assert.equal(result.context.journey.pendingQuestionId, 'hasKidsOrPets');
    assert.notEqual(result.context.journey.stage, 'done');
  });
});
