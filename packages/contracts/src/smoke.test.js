import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClientRequestSchema,
  CommandRecordSchema,
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
      expectedVersion: 0,
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
        expectedVersion: 0,
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

  it('accepts English, Russian, and Serbian intent language', () => {
    const intent = {
      kind: 'help',
      confidence: 1,
      language: 'en',
      rawText: 'help',
      slots: {}
    };
    assert.equal(IntentResultSchema.parse(intent).language, 'en');
    assert.equal(
      IntentResultSchema.parse({ ...intent, language: 'ru', rawText: 'помощь' }).language,
      'ru'
    );
    assert.equal(
      IntentResultSchema.parse({ ...intent, language: 'sr', rawText: 'pomoć' }).language,
      'sr'
    );
    assert.throws(() => IntentResultSchema.parse({ ...intent, language: 'fr' }));
  });

  it('parses a command journal record', () => {
    const record = CommandRecordSchema.parse({
      requestId: 'req-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
      seq: 1,
      rawInput: 'add base cabinet 600',
      inputChannel: 'text',
      language: 'en',
      intentKind: 'add_module',
      outcomeKind: 'applied',
      compatibilityValid: true,
      resultingVersion: 1,
      catalogSnapshotId: 'kitchen-demo-v1',
      createdAt: new Date().toISOString()
    });
    assert.equal(record.seq, 1);
    assert.equal(record.outcomeKind, 'applied');
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
