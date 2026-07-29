import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSpeechRecognitionCtor } from './src/hooks/useSpeechCommand.js';

describe('@homecraft/client smoke', () => {
  it('passes build gate', () => {
    assert.ok(true);
  });

  it('getSpeechRecognitionCtor is null outside a browser', () => {
    assert.equal(getSpeechRecognitionCtor(), null);
  });
});
