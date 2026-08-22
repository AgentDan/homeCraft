import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURNEY_QUESTION_INDEXES,
  LEGACY_JOURNEY_QUESTION_INDEXES,
  journeyQuestionCleanupFilter,
  journeyQuestionReadFilter
} from './mongo.js';

describe('journey_questions mongo index + query shape', () => {
  it('uses a compound unique index on (productType, slot)', () => {
    const unique = JOURNEY_QUESTION_INDEXES.find(
      (index) => index.name === 'product_slot_unique'
    );
    assert.ok(unique);
    assert.deepEqual(unique.key, { productType: 1, slot: 1 });
    assert.equal(unique.unique, true);
    assert.ok(LEGACY_JOURNEY_QUESTION_INDEXES.includes('slot_unique'));
  });

  it('prefixes the stage/order index with productType', () => {
    const ordered = JOURNEY_QUESTION_INDEXES.find(
      (index) => index.name === 'product_stage_order'
    );
    assert.ok(ordered);
    assert.deepEqual(ordered.key, { productType: 1, stage: 1, order: 1 });
    assert.ok(LEGACY_JOURNEY_QUESTION_INDEXES.includes('stage_order'));
  });

  it('scopes deleteMany cleanup to one productType so kitchen saves cannot wipe desk', () => {
    assert.deepEqual(journeyQuestionCleanupFilter('kitchen', ['clientName', 'budgetEur']), {
      productType: 'kitchen',
      slot: { $nin: ['clientName', 'budgetEur'] }
    });
    assert.deepEqual(journeyQuestionCleanupFilter('desk', []), { productType: 'desk' });
    assert.notDeepEqual(
      journeyQuestionCleanupFilter('kitchen', ['clientName']),
      { slot: { $nin: ['clientName'] } }
    );
  });

  it('reads kitchen legacy documents that predate the productType field', () => {
    assert.deepEqual(journeyQuestionReadFilter('desk'), { productType: 'desk' });
    assert.deepEqual(journeyQuestionReadFilter('kitchen'), {
      $or: [{ productType: 'kitchen' }, { productType: { $exists: false } }]
    });
  });
});
