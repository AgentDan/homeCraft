import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchIntent } from './index.js';

describe('@homecraft/ai smoke', () => {
  it('returns unknown for unmatched text', () => {
    const result = matchIntent('random text without an intent');
    assert.equal(result.kind, 'unknown');
    assert.equal(result.language, 'en');
  });

  it('detects help intent in English', () => {
    const result = matchIntent('what can you do');
    assert.equal(result.kind, 'help');
    assert.equal(result.language, 'en');
  });

  it('detects Russian help and add_module intents', () => {
    assert.equal(matchIntent('помощь', { language: 'ru' }).kind, 'help');
    const add = matchIntent('добавь шкаф 600', { language: 'ru' });
    assert.equal(add.kind, 'add_module');
    assert.equal(add.language, 'ru');
    assert.equal(/** @type {{ slots?: { widthMm?: number } }} */ (add).slots?.widthMm, 600);
  });

  it('detects undo and redo without ambiguous fallback', () => {
    assert.equal(matchIntent('revert the last change').kind, 'undo');
    assert.equal(matchIntent('repeat').kind, 'redo');
  });

  it('detects replace_module for conflict resolution commands', () => {
    const result = /** @type {{ kind: string, slots?: { instanceId?: string, sku?: string } }} */ (
      matchIntent('replace module-2 with BASE-400')
    );
    assert.equal(result.kind, 'replace_module');
    assert.equal(result.slots?.instanceId, 'module-2');
    assert.equal(result.slots?.sku, 'BASE-400');
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
      ([phrase, expected]) => matchIntent(phrase).kind === expected
    ).length;
    assert.ok(
      correct / corpus.length >= 0.85,
      `Intent accuracy was ${correct}/${corpus.length}.`
    );
  });
});
