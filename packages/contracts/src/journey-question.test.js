import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  JourneyQuestionTableSchema,
  ValidationSchema
} from './index.js';

describe('journey-question contracts', () => {
  it('parses validation discriminated union', () => {
    assert.equal(
      ValidationSchema.parse({
        type: 'dimension',
        min: 500,
        max: 20000,
        unit: 'mm',
        acceptNlu: true
      }).type,
      'dimension'
    );
  });

  it('rejects dependsOn that points forward in order', () => {
    assert.throws(() =>
      JourneyQuestionTableSchema.parse([
        {
          id: 'a',
          slot: 'a',
          stage: 'survey',
          order: 10,
          i18nKey: 'a',
          validation: { type: 'enum', options: ['yes', 'no'] },
          dependsOn: { slot: 'b', operator: 'equals', value: 'yes' },
          active: true
        },
        {
          id: 'b',
          slot: 'b',
          stage: 'survey',
          order: 20,
          i18nKey: 'b',
          validation: { type: 'enum', options: ['yes', 'no'] },
          dependsOn: null,
          active: true
        }
      ])
    );
  });

  it('accepts dependsOn to an earlier slot', () => {
    const table = JourneyQuestionTableSchema.parse([
      {
        id: 'hasKidsOrPets',
        slot: 'hasKidsOrPets',
        stage: 'survey',
        order: 10,
        i18nKey: 'k',
        validation: { type: 'enum', options: ['yes', 'no'] },
        dependsOn: null,
        active: true
      },
      {
        id: 'facadeMaterialPreference',
        slot: 'facadeMaterialPreference',
        stage: 'survey',
        order: 20,
        i18nKey: 'f',
        validation: { type: 'enum', options: ['durable'] },
        dependsOn: {
          slot: 'hasKidsOrPets',
          operator: 'equals',
          value: 'yes'
        },
        active: true
      }
    ]);
    assert.equal(table.length, 2);
  });
});
