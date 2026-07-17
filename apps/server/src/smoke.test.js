import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClientResponseSchema, createEmptyPlan } from '@homecraft/contracts';
import { assertCompatible } from './compatibility-engine/assertCompatible.js';

describe('@homecraft/server smoke', () => {
  it('compatibility returns valid in step0', async () => {
    const plan = createEmptyPlan({
      planId: 'p1',
      projectId: 'proj-1',
      catalogSnapshotId: 'snap-1'
    });
    const report = await assertCompatible(plan, {
      projectId: 'proj-1',
      sessionId: 'sess-1',
      catalogSnapshotId: 'snap-1',
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
      const voice = await postCommand('добавь модуль', 'req-voice', 'voice');
      assert.equal(voice.responseType, 'scene');
      assert.equal(voice.planVersion, 1);

      const second = await postCommand('цвет дуб', 'req-second');
      assert.equal(second.planVersion, 2);

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
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
