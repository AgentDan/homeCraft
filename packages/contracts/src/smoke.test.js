import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClientRequestSchema, createStubClientResponse } from './index.js';

describe('@homecraft/contracts smoke', () => {
  it('parses a minimal client request', () => {
    const parsed = ClientRequestSchema.parse({
      requestId: 'req-1',
      sessionId: 'sess-1',
      projectId: 'proj-1',
      inputMode: 'dialog',
      command: 'привет',
      clientState: {}
    });
    assert.equal(parsed.inputMode, 'dialog');
  });

  it('creates stub client response', () => {
    const response = createStubClientResponse({
      requestId: 'req-1',
      sessionId: 'sess-1',
      projectId: 'proj-1'
    });
    assert.equal(response.status, 'ok');
  });
});
