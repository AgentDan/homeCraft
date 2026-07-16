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
});
