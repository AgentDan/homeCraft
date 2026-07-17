import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ClientResponseSchema,
  ConfigurationPlanSchema,
  createEmptyPlan
} from '@homecraft/contracts';
import { assertCompatible } from './compatibility-engine/assertCompatible.js';
import { closeMongo } from './storage/mongo.js';
import { retrieve } from './ai-services/catalog-rag-retriever.js';

describe('@homecraft/server smoke', () => {
  it('retrieves grounded modules from the demo catalog', async () => {
    const modules = await retrieve(
      'добавь шкаф под мойку 800',
      'kitchen-demo-v1',
      3
    );
    assert.equal(modules[0].sku, 'SINK-800');
    assert.ok(modules.every((module) => module.source === 'catalog:kitchen-demo-v1'));
  });

  it('compatibility accepts an empty Phase 1 plan', async () => {
    const plan = createEmptyPlan({
      planId: 'p1',
      projectId: 'proj-1',
      catalogSnapshotId: 'kitchen-demo-v1'
    });
    const report = await assertCompatible(plan, {
      projectId: 'proj-1',
      sessionId: 'sess-1',
      catalogSnapshotId: 'kitchen-demo-v1',
      roomShape: {
        dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
        walls: [],
        openings: [],
        utilities: []
      },
      dialogTurns: [],
      updatedAt: new Date().toISOString()
    });
    assert.equal(report.valid, true);
  });

  it('compatibility detects overlap, room bounds, and mounting errors', async () => {
    const plan = ConfigurationPlanSchema.parse({
      planId: 'p-conflicts',
      projectId: 'proj-1',
      catalogSnapshotId: 'kitchen-demo-v1',
      operations: [
        {
          type: 'add_module',
          sku: 'BASE-600',
          position: { x: 2600, y: 100, z: 0 },
          rotationY: 0
        },
        {
          type: 'add_module',
          sku: 'BASE-400',
          position: { x: 2700, y: 100, z: 0 },
          rotationY: 0
        }
      ],
      createdAt: new Date().toISOString()
    });
    const report = await assertCompatible(plan, {
      projectId: 'proj-1',
      sessionId: 'sess-1',
      catalogSnapshotId: 'kitchen-demo-v1',
      roomShape: {
        dimensions: { widthMm: 3000, depthMm: 4000, heightMm: 2700 },
        walls: [],
        openings: [],
        utilities: []
      },
      dialogTurns: [],
      updatedAt: new Date().toISOString()
    });
    assert.equal(report.valid, false);
    assert.ok(report.conflicts.some((conflict) => conflict.kind === 'overlap'));
    assert.ok(
      report.conflicts.some((conflict) => conflict.kind === 'dimension_exceeded')
    );
    assert.ok(
      report.conflicts.some((conflict) => conflict.kind === 'mounting_mismatch')
    );
  });

  it('rejects legacy editor request shape over HTTP', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-smoke-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('./app.js');
    const app = createApp();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not expose a TCP port.');
    }
    const endpoint = `http://127.0.0.1:${address.port}/api/commands`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'req-editor',
          sessionId: 'sess-editor',
          projectId: 'proj-editor',
          inputMode: 'editor',
          editorOperations: [],
          command: 'передвинь шкаф',
          clientState: {}
        })
      });
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.equal(body.status, 'error');
      assert.equal(body.message, 'Validation failed');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it('accepts voice commands and supports undo over HTTP', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-smoke-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('./app.js');
    const app = createApp();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not expose a TCP port.');
    }
    const endpoint = `http://127.0.0.1:${address.port}/api/commands`;
    const sessionId = `sess-${Date.now()}`;
    const projectId = `proj-${Date.now()}`;

    async function postCommand(command, requestId, inputChannel = 'text') {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          sessionId,
          projectId,
          inputChannel,
          command,
          clientState: {}
        })
      });
      assert.equal(response.status, 200);
      return ClientResponseSchema.parse(await response.json());
    }

    try {
      const starterResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'req-starter-kitchen',
          sessionId: `${sessionId}-starter`,
          projectId: `${projectId}-starter`,
          inputChannel: 'text',
          command: 'кухня 3×4',
          clientState: {}
        })
      });
      assert.equal(starterResponse.status, 200);
      const starter = ClientResponseSchema.parse(await starterResponse.json());
      assert.equal(starter.responseType, 'scene');
      assert.equal(starter.view?.kind, '3d_scene');
      assert.equal(starter.sceneResult?.modules.length, 4);

      const voice = await postCommand('добавь модуль', 'req-voice', 'voice');
      assert.equal(voice.responseType, 'scene');
      assert.equal(voice.planVersion, 1);
      assert.equal(voice.plan?.operations.length, 1);
      assert.equal(voice.sceneResult?.modules.length, 1);
      assert.ok((voice.bom?.totalRub ?? 0) > 0);

      const second = await postCommand('цвет дуб', 'req-second');
      assert.equal(second.planVersion, 2);
      assert.equal(second.sceneResult?.modules[0].finishId, 'oak');

      const budget = await postCommand('бюджет до 10000', 'req-budget');
      assert.equal(budget.planVersion, 2);
      assert.match(budget.explanation ?? '', /превышает бюджет/);

      const price = await postCommand('покажи стоимость', 'req-price');
      assert.equal(price.planVersion, 2);
      assert.ok((price.bom?.totalRub ?? 0) > 0);

      const help = await postCommand('помощь', 'req-help');
      assert.equal(help.responseType, 'help');
      assert.match(help.message, /Примеры команд/);

      const undo = await postCommand('отмени', 'req-undo');
      assert.equal(undo.responseType, 'scene');
      assert.equal(undo.planVersion, 1);
      assert.ok(undo.view);
      assert.equal(undo.view.render, 'full');

      const noMoreUndo = await postCommand('отмени', 'req-empty-undo');
      assert.equal(noMoreUndo.responseType, 'clarify');
      assert.equal(noMoreUndo.interaction.expects, 'free_text');

      const redo = await postCommand('повтори', 'req-redo');
      assert.equal(redo.responseType, 'scene');
      assert.equal(redo.planVersion, 2);
      assert.ok(redo.view);
      assert.equal(redo.view.render, 'full');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
