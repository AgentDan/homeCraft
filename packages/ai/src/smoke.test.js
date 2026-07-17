import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchIntent } from './index.js';

describe('@homecraft/ai smoke', () => {
  it('returns unknown for unmatched text', () => {
    const result = matchIntent('случайный текст без интента');
    assert.equal(result.kind, 'unknown');
  });

  it('detects help intent in Russian', () => {
    const result = matchIntent('что ты умеешь');
    assert.equal(result.kind, 'help');
  });

  it('detects undo and redo without ambiguous fallback', () => {
    assert.equal(matchIntent('верни как было').kind, 'undo');
    assert.equal(matchIntent('повтори').kind, 'redo');
  });

  it('reaches at least 85% accuracy on the Phase 1 RU corpus', () => {
    const corpus = [
      ['добавь шкаф', 'add_module'],
      ['добавить модуль 600', 'add_module'],
      ['поставь тумбу с ящиками', 'add_module'],
      ['установи шкаф под мойку', 'add_module'],
      ['кухня 3 на 4', 'add_module'],
      ['кухня 3×4', 'add_module'],
      ['добавь навесной шкаф', 'add_module'],
      ['убери последний шкаф', 'remove_module'],
      ['удали модуль', 'remove_module'],
      ['убрать тумбу', 'remove_module'],
      ['удалить module-2', 'remove_module'],
      ['уберите пенал', 'remove_module'],
      ['remove cabinet', 'remove_module'],
      ['delete module-1', 'remove_module'],
      ['цвет дуб', 'change_finish'],
      ['сделай фасад белым', 'change_finish'],
      ['измени отделку на дуб', 'change_finish'],
      ['материал фасада дуб', 'change_finish'],
      ['дубовый фасад', 'change_finish'],
      ['change finish to oak', 'change_finish'],
      ['белый цвет', 'change_finish'],
      ['бюджет 150000', 'set_budget'],
      ['бюджет до 200 000', 'set_budget'],
      ['до 120000', 'set_budget'],
      ['установи бюджет 90000', 'set_budget'],
      ['budget 100000', 'set_budget'],
      ['мой бюджет 250000', 'set_budget'],
      ['до 75 000 рублей', 'set_budget'],
      ['сколько стоит', 'show_price'],
      ['какая цена', 'show_price'],
      ['покажи стоимость', 'show_price'],
      ['итого по проекту', 'show_price'],
      ['price', 'show_price'],
      ['стоимость кухни', 'show_price'],
      ['сколько всё стоит', 'show_price'],
      ['помощь', 'help'],
      ['что ты умеешь', 'help'],
      ['help', 'help'],
      ['what can you do', 'help'],
      ['покажи помощь', 'help'],
      ['привет', 'unknown'],
      ['как дела', 'unknown'],
      ['случайный текст', 'unknown'],
      ['расскажи анекдот', 'unknown'],
      ['доброе утро', 'unknown'],
      ['отмени', 'undo'],
      ['отменить', 'undo'],
      ['назад', 'undo'],
      ['undo', 'undo'],
      ['верни как было', 'undo'],
      ['повтори', 'redo'],
      ['верни последнее', 'redo'],
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
