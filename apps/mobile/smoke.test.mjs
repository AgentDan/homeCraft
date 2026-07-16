import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('@homecraft/mobile smoke', () => {
  it('stub workspace is wired', () => {
    assert.equal(typeof process.version, 'string');
  });
});
