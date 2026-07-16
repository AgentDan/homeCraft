import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClientRequestSchema,
  createClarifyResponse,
  createConfirmResponse,
  createOptionsResponse,
  createStubClientResponse
} from './index.js';

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
    assert.equal(parsed.inputChannel, 'text');
  });

  it('creates stub client response', () => {
    const response = createStubClientResponse({
      requestId: 'req-1',
      sessionId: 'sess-1',
      projectId: 'proj-1'
    });
    assert.equal(response.status, 'ok');
    assert.equal(response.planVersion, 0);
    assert.equal(response.interaction.expects, 'none');
  });

  it('creates rich interactive responses', () => {
    const ids = {
      requestId: 'req-2',
      sessionId: 'sess-2',
      projectId: 'proj-2'
    };
    const clarify = createClarifyResponse({ ...ids, prompt: 'Уточните размер.' });
    const options = createOptionsResponse({
      ...ids,
      prompt: 'Выберите фасад.',
      options: [{ id: 'oak', label: 'Дуб' }]
    });
    const confirm = createConfirmResponse({ ...ids, prompt: 'Подтвердить изменения?' });

    assert.equal(clarify.interaction.expects, 'free_text');
    assert.ok(options.interaction.options);
    assert.equal(options.interaction.options[0].id, 'oak');
    assert.equal(confirm.responseType, 'confirm');
  });
});
