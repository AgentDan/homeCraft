/**
 * Kitchen Discovery-phase questions (business content, not core mechanism).
 * Core journey-table.js only validates/advances this table after
 * registry.initDomain() copies it into the live JOURNEY_QUESTIONS array.
 */
import { JourneyQuestionTableSchema } from '@homecraft/contracts';

export const kitchenJourneyQuestions = JourneyQuestionTableSchema.parse([
  {
    id: 'clientName',
    slot: 'clientName',
    stage: 'intro',
    order: 10,
    i18nKey: 'journeyAskClientName',
    validation: {
      type: 'text',
      minLength: 1,
      maxLength: 80,
      rejectIfNumeric: true
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'projectGoal',
    slot: 'projectGoal',
    stage: 'brief',
    order: 20,
    i18nKey: 'journeyAskProjectGoal',
    validation: { type: 'text', minLength: 2, maxLength: 240 },
    dependsOn: null,
    active: true
  },
  {
    id: 'roomWidthMm',
    slot: 'roomWidthMm',
    stage: 'survey',
    order: 30,
    i18nKey: 'journeyAskRoomWidth',
    validation: {
      type: 'dimension',
      min: 500,
      max: 20000,
      unit: 'mm',
      acceptNlu: true
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'roomDepthMm',
    slot: 'roomDepthMm',
    stage: 'survey',
    order: 40,
    i18nKey: 'journeyAskRoomDepth',
    validation: {
      type: 'dimension',
      min: 500,
      max: 20000,
      unit: 'mm',
      acceptNlu: true
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'hasKidsOrPets',
    slot: 'hasKidsOrPets',
    stage: 'survey',
    order: 50,
    i18nKey: 'journeyAskHasKidsOrPets',
    validation: {
      type: 'enum',
      options: ['yes', 'no']
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'facadeMaterialPreference',
    slot: 'facadeMaterialPreference',
    stage: 'survey',
    order: 60,
    i18nKey: 'journeyAskFacadeMaterial',
    validation: {
      type: 'enum',
      options: ['durable', 'soft', 'mixed']
    },
    dependsOn: {
      slot: 'hasKidsOrPets',
      operator: 'equals',
      value: 'yes'
    },
    active: true
  },
  {
    id: 'shoppingHabit',
    slot: 'shoppingHabit',
    stage: 'survey',
    order: 70,
    i18nKey: 'journeyAskShoppingHabit',
    validation: {
      type: 'enum',
      options: ['browse', 'decide_fast', 'research']
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'socialStyle',
    slot: 'socialStyle',
    stage: 'survey',
    order: 80,
    i18nKey: 'journeyAskSocialStyle',
    validation: {
      type: 'enum',
      options: ['private', 'hosting', 'family']
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'budgetEur',
    slot: 'budgetEur',
    stage: 'survey',
    order: 90,
    i18nKey: 'journeyAskBudgetEur',
    validation: {
      type: 'number',
      min: 100,
      max: 1_000_000,
      integer: true
    },
    dependsOn: null,
    active: true
  }
]);
