import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { detectIntent } from './intent-detector.js';
import {
  extractJsonObject,
  parseIntentWithLlm
} from './llm-intent-parser.js';
import { buildIntentParsePrompt } from './llm-provider.js';

describe('llm-intent-parser helpers', () => {
  it('extracts JSON from raw and fenced completions', () => {
    assert.deepEqual(extractJsonObject('{"kind":"help","confidence":0.9,"language":"en","slots":{}}'), {
      kind: 'help',
      confidence: 0.9,
      language: 'en',
      slots: {}
    });
    assert.equal(
      /** @type {{ kind: string }} */ (
        extractJsonObject('Here:\n```json\n{"kind":"unknown","language":"en","reason":"x"}\n```')
      ).kind,
      'unknown'
    );
    assert.equal(extractJsonObject('not json'), null);
  });

  it('buildIntentParsePrompt lists allowed kinds', () => {
    const prompt = buildIntentParsePrompt('add base 600', 'en');
    assert.match(prompt, /add_module/);
    assert.match(prompt, /create_branch/);
    assert.match(prompt, /add base 600/);
  });
});

describe('parseIntentWithLlm', () => {
  it('accepts a valid LLM intent and sanitizes invented ids', async () => {
    const intent = await parseIntentWithLlm('replace the last with BASE-400', 'en', {
      provider: {
        async complete() {
          return JSON.stringify({
            kind: 'replace_module',
            confidence: 0.91,
            language: 'en',
            slots: {
              sku: 'BASE-400',
              instanceId: 'the last cabinet',
              finishId: 'oak'
            }
          });
        }
      }
    });
    assert.ok(intent);
    assert.equal(intent.kind, 'replace_module');
    if (intent.kind !== 'replace_module') return;
    assert.equal(intent.slots.sku, 'BASE-400');
    assert.equal(intent.slots.instanceId, undefined);
    assert.equal(intent.slots.finishId, 'oak');
    assert.equal(intent.rawText, 'replace the last with BASE-400');
  });

  it('returns null on Zod-invalid kind so caller can fall back', async () => {
    const intent = await parseIntentWithLlm('do magic', 'en', {
      provider: {
        async complete() {
          return JSON.stringify({
            kind: 'teleport_module',
            confidence: 0.99,
            language: 'en',
            slots: {}
          });
        }
      }
    });
    assert.equal(intent, null);
  });
});

describe('detectIntent LLM flag path', () => {
  before(() => {
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
  });
  it('uses rule-based matchIntent when no LLM provider is injected', async () => {
    const intent = await detectIntent('help', 'en', { llmProvider: null });
    assert.equal(intent.kind, 'help');
  });

  it('uses the LLM result when the mock provider returns valid JSON', async () => {
    const intent = await detectIntent('please put a narrow base cabinet', 'en', {
      llmProvider: {
        async complete() {
          return JSON.stringify({
            kind: 'add_module',
            confidence: 0.88,
            language: 'en',
            slots: { category: 'base_cabinet', widthMm: 400 }
          });
        }
      }
    });
    assert.equal(intent.kind, 'add_module');
    if (intent.kind !== 'add_module') return;
    assert.equal(intent.confidence, 0.88);
    assert.equal(intent.slots.widthMm, 400);
  });

  it('falls back to rules when the LLM provider throws', async () => {
    const intent = await detectIntent('help', 'en', {
      llmProvider: {
        async complete() {
          throw new Error('network down');
        }
      }
    });
    assert.equal(intent.kind, 'help');
  });

  it('falls back to rules when LLM returns invalid JSON', async () => {
    const intent = await detectIntent('undo', 'en', {
      llmProvider: {
        async complete() {
          return 'sorry, I cannot';
        }
      }
    });
    assert.equal(intent.kind, 'undo');
  });
});
