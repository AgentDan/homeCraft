import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import { registry } from '@homecraft/contracts';
import { replaceJourneyQuestions, getJourneyQuestions } from '../journey-table.js';
import {
  getRecommendationRules,
  replaceRecommendationRules
} from '../recommendation-engine.js';
import { closeMongo } from '../../storage/mongo.js';

const DESK_ADMIN_QUESTION = {
  id: 'clientName',
  slot: 'clientName',
  stage: 'intro',
  order: 99,
  i18nKey: 'journeyAskClientName',
  validation: { type: 'text', minLength: 1, maxLength: 80, rejectIfNumeric: true },
  dependsOn: null,
  active: true
};

const DESK_ADMIN_RULE = {
  ruleId: 'desk_admin_only',
  priority: 1,
  condition: { always: true },
  action: { type: 'filterCatalog', filters: { sku: 'BASE-400' } },
  active: true
};

describe('admin per-domain journey-questions + recommendation-rules', () => {
  /** @type {string} */
  let storageRoot;
  /** @type {import('http').Server | null} */
  let server = null;
  /** @type {string} */
  let origin = '';

  before(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-admin-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(deskManifest);
    }
    replaceJourneyQuestions('kitchen', kitchenManifest.journeyQuestions);
    replaceJourneyQuestions('desk', deskManifest.journeyQuestions);
    replaceRecommendationRules('kitchen', kitchenManifest.dp4Rules);
    replaceRecommendationRules('desk', deskManifest.dp4Rules);

    const { createApp } = await import('../../app.js');
    const app = createApp();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not expose a TCP port.');
    }
    origin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeMongo();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('PUT journey-questions?productType=desk does not change kitchen questions', async () => {
    const kitchenBefore = getJourneyQuestions('kitchen').length;
    const put = await fetch(
      `${origin}/api/admin/journey-questions?productType=desk`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: [DESK_ADMIN_QUESTION] })
      }
    );
    assert.equal(put.status, 200);
    const putBody = await put.json();
    assert.equal(putBody.status, 'ok');
    assert.equal(putBody.questions.length, 1);
    assert.ok(putBody.persisted === 'mongo' || putBody.persisted === 'memory');

    const deskGet = await fetch(
      `${origin}/api/admin/journey-questions?productType=desk`
    );
    const deskBody = await deskGet.json();
    assert.equal(deskBody.questions.length, 1);
    assert.equal(deskBody.questions[0].order, 99);

    const kitchenGet = await fetch(
      `${origin}/api/admin/journey-questions?productType=kitchen`
    );
    const kitchenBody = await kitchenGet.json();
    assert.equal(kitchenBody.questions.length, kitchenBefore);
    assert.ok(kitchenBody.questions.some((q) => q.slot === 'hasKidsOrPets'));
    assert.equal(getJourneyQuestions('kitchen').length, kitchenBefore);
  });

  it('PUT recommendation-rules?productType=desk does not change kitchen rules', async () => {
    const kitchenBefore = getRecommendationRules('kitchen').map((rule) => rule.ruleId);
    const put = await fetch(
      `${origin}/api/admin/recommendation-rules?productType=desk`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: [DESK_ADMIN_RULE] })
      }
    );
    assert.equal(put.status, 200);
    const putBody = await put.json();
    assert.equal(putBody.status, 'ok');
    assert.equal(putBody.rules.length, 1);
    assert.equal(putBody.persisted, 'file');

    const deskGet = await fetch(
      `${origin}/api/admin/recommendation-rules?productType=desk`
    );
    const deskBody = await deskGet.json();
    assert.equal(deskBody.rules[0].ruleId, 'desk_admin_only');

    const kitchenGet = await fetch(
      `${origin}/api/admin/recommendation-rules?productType=kitchen`
    );
    const kitchenBody = await kitchenGet.json();
    assert.deepEqual(
      kitchenBody.rules.map((rule) => rule.ruleId),
      kitchenBefore
    );
  });

  it('omitting productType keeps the kitchen default', async () => {
    const response = await fetch(`${origin}/api/admin/journey-questions`);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.questions.some((q) => q.slot === 'hasKidsOrPets'));
  });
});
