import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClientRequestSchema,
  IntentResultSchema,
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
      command: 'hello',
      clientState: {}
    });
    assert.equal(parsed.command, 'hello');
    assert.equal(parsed.inputChannel, 'text');
  });

  it('rejects the removed editor-only request shape', () => {
    assert.throws(() =>
      ClientRequestSchema.parse({
        requestId: 'req-1',
        sessionId: 'sess-1',
        projectId: 'proj-1',
        inputMode: 'editor',
        editorOperations: [],
        clientState: {}
      })
    );
  });

  it('rejects legacy editor fields even when command is present', () => {
    assert.throws(() =>
      ClientRequestSchema.parse({
        requestId: 'req-1',
        sessionId: 'sess-1',
        projectId: 'proj-1',
        command: 'move the cabinet',
        inputMode: 'editor',
        editorOperations: [],
        clientState: {}
      })
    );
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

  it('accepts only English intent language', () => {
    const intent = {
      kind: 'help',
      confidence: 1,
      language: 'en',
      rawText: 'help',
      slots: {}
    };
    assert.equal(IntentResultSchema.parse(intent).language, 'en');
    assert.throws(() => IntentResultSchema.parse({ ...intent, language: 'fr' }));
  });

  it('creates rich interactive responses', () => {
    const ids = {
      requestId: 'req-2',
      sessionId: 'sess-2',
      projectId: 'proj-2'
    };
    const clarify = createClarifyResponse({ ...ids, prompt: 'Specify the size.' });
    const options = createOptionsResponse({
      ...ids,
      prompt: 'Choose a finish.',
      options: [{ id: 'oak', label: 'Oak' }]
    });
    const confirm = createConfirmResponse({ ...ids, prompt: 'Confirm the changes?' });

    assert.equal(clarify.interaction.expects, 'free_text');
    assert.ok(options.interaction.options);
    assert.equal(options.interaction.options[0].id, 'oak');
    assert.equal(confirm.responseType, 'confirm');
  });
});
