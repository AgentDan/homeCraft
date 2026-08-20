import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchIntent } from './index.js';
import { kitchenIntentRules } from '../../manifests/kitchen/intent-rules.js';
import { deskIntentRules } from '../../manifests/desk/intent-rules.js';

/**
 * @param {string} text
 * @param {{ language?: 'en' | 'ru' | 'sr' }} [options]
 */
function match(text, options = {}) {
  return matchIntent(text, kitchenIntentRules, options);
}

describe('@homecraft/ai smoke', () => {
  it('throws when rules are missing or empty', () => {
    assert.throws(() => matchIntent('help'), /matchIntent: rules is required/);
    assert.throws(
      () => matchIntent('help', /** @type {never} */ (null)),
      /matchIntent: rules is required/
    );
    assert.throws(() => matchIntent('help', []), /matchIntent: rules is required/);
    assert.throws(
      () => matchIntent('help', /** @type {never} */ ({})),
      /matchIntent: rules is required/
    );
  });

  it('returns unknown for unmatched text', () => {
    const result = match('random text without an intent');
    assert.equal(result.kind, 'unknown');
    assert.equal(result.language, 'en');
  });

  it('detects help intent in English', () => {
    const result = match('what can you do');
    assert.equal(result.kind, 'help');
    assert.equal(result.language, 'en');
  });

  it('detects catalog / commands as help', () => {
    assert.equal(match('show catalog', { language: 'en' }).kind, 'help');
    assert.equal(match('каталог', { language: 'ru' }).kind, 'help');
    assert.equal(match('какие команды', { language: 'ru' }).kind, 'help');
    assert.equal(match('katalog', { language: 'sr' }).kind, 'help');
  });

  it('detects Russian help and add_module intents', () => {
    assert.equal(match('помощь', { language: 'ru' }).kind, 'help');
    const add = match('добавь шкаф 600', { language: 'ru' });
    assert.equal(add.kind, 'add_module');
    assert.equal(add.language, 'ru');
    assert.equal(/** @type {{ slots?: { widthMm?: number } }} */ (add).slots?.widthMm, 600);
  });

  it('detects Serbian help and add_module intents', () => {
    assert.equal(match('pomoć', { language: 'sr' }).kind, 'help');
    const add = match('dodaj ormar 600', { language: 'sr' });
    assert.equal(add.kind, 'add_module');
    assert.equal(add.language, 'sr');
    assert.equal(/** @type {{ slots?: { widthMm?: number } }} */ (add).slots?.widthMm, 600);
  });

  it('infers sr from Serbian Cyrillic when language is omitted', () => {
    const result = match('додај ормар 600');
    assert.equal(result.kind, 'add_module');
    assert.equal(result.language, 'sr');
  });

  it('detects export_project intent', () => {
    assert.equal(match('export pdf', { language: 'en' }).kind, 'export_project');
    assert.equal(match('экспорт pdf', { language: 'ru' }).kind, 'export_project');
  });

  it('detects create_branch and switch_branch', () => {
    const created = match('create branch alt');
    assert.equal(created.kind, 'create_branch');
    assert.equal(created.slots?.branchName, 'alt');
    assert.equal(
      match('создай ветку option-b', { language: 'ru' }).kind,
      'create_branch'
    );
    const switched = match('switch branch main');
    assert.equal(switched.kind, 'switch_branch');
    assert.equal(switched.slots?.branchName, 'main');
  });

  it('detects undo and redo without ambiguous fallback', () => {
    assert.equal(match('revert the last change').kind, 'undo');
    assert.equal(match('repeat').kind, 'redo');
  });

  it('detects replace_module for conflict resolution commands', () => {
    const result = /** @type {{ kind: string, slots?: { instanceId?: string, sku?: string } }} */ (
      match('replace module-2 with BASE-400')
    );
    assert.equal(result.kind, 'replace_module');
    assert.equal(result.slots?.instanceId, 'module-2');
    assert.equal(result.slots?.sku, 'BASE-400');
  });

  it('deskIntentRules classifies a desk phrase independently from kitchen', () => {
    const phrase = 'add a desk';
    assert.equal(matchIntent(phrase, deskIntentRules).kind, 'add_module');
    assert.equal(matchIntent(phrase, kitchenIntentRules).kind, 'unknown');
    assert.equal(matchIntent('add a cabinet', kitchenIntentRules).kind, 'add_module');
    assert.equal(matchIntent('add a cabinet', deskIntentRules).kind, 'unknown');
  });

  it('reaches at least 85% accuracy on the Phase 1 English corpus', () => {
    const corpus = [
      ['add a cabinet', 'add_module'],
      ['add a 600 mm module', 'add_module'],
      ['place a cabinet with drawers', 'add_module'],
      ['install a sink cabinet', 'add_module'],
      ['kitchen 3 by 4', 'add_module'],
      ['kitchen 3×4', 'add_module'],
      ['add a wall cabinet', 'add_module'],
      ['replace module-1 with BASE-400', 'replace_module'],
      ['swap module-2 with WALL-600', 'replace_module'],
      ['remove the last cabinet', 'remove_module'],
      ['delete a module', 'remove_module'],
      ['remove the cupboard', 'remove_module'],
      ['delete module-2', 'remove_module'],
      ['remove the pantry', 'remove_module'],
      ['remove cabinet', 'remove_module'],
      ['delete module-1', 'remove_module'],
      ['oak color', 'change_finish'],
      ['make the facade white', 'change_finish'],
      ['change the finish to oak', 'change_finish'],
      ['oak facade material', 'change_finish'],
      ['oak front', 'change_finish'],
      ['change finish to oak', 'change_finish'],
      ['white color', 'change_finish'],
      ['budget 150000', 'set_budget'],
      ['budget up to 200,000', 'set_budget'],
      ['up to 120000', 'set_budget'],
      ['set a budget of 90000', 'set_budget'],
      ['budget 100000', 'set_budget'],
      ['my budget is 250000', 'set_budget'],
      ['up to $75,000', 'set_budget'],
      ['how much does it cost', 'show_price'],
      ['what is the price', 'show_price'],
      ['show the cost', 'show_price'],
      ['project total', 'show_price'],
      ['price', 'show_price'],
      ['kitchen cost', 'show_price'],
      ['how much does everything cost', 'show_price'],
      ['help me', 'help'],
      ['what can you do', 'help'],
      ['help', 'help'],
      ['show help', 'help'],
      ['hello', 'unknown'],
      ['how are you', 'unknown'],
      ['random text', 'unknown'],
      ['tell me a joke', 'unknown'],
      ['good morning', 'unknown'],
      ['revert', 'undo'],
      ['go back', 'undo'],
      ['undo', 'undo'],
      ['repeat', 'redo'],
      ['repeat the last action', 'redo'],
      ['redo', 'redo']
    ];
    const correct = corpus.filter(
      ([phrase, expected]) => match(phrase).kind === expected
    ).length;
    assert.ok(
      correct / corpus.length >= 0.85,
      `Intent accuracy was ${correct}/${corpus.length}.`
    );
  });
});
