import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClientResponseSchema } from '@homecraft/contracts';
import { closeMongo } from './mongo.js';

describe('replayJournal', () => {
  it('rebuilds the same plan operations from the command journal', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-replay-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('../app.js');
    const {
      loadCurrentPlanSnapshot,
      replayJournal
    } = await import('./replay-journal.js');
    const { loadCommandJournal } = await import('./local-storage.js');

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
    const sessionId = `sess-replay-${Date.now()}`;
    const projectId = `proj-replay-${Date.now()}`;
    let expectedVersion = 0;

    async function post(command, requestId) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          sessionId,
          projectId,
          command,
          expectedVersion,
          clientState: {}
        })
      });
      assert.equal(response.status, 200);
      const body = ClientResponseSchema.parse(await response.json());
      expectedVersion = body.planVersion;
      return body;
    }

    try {
      await post('add module', 'req-r1');
      await post('oak finish', 'req-r2');
      await post('show price', 'req-r3');
      await post('undo', 'req-r4');

      const journal = await loadCommandJournal(projectId);
      assert.ok(journal.length >= 4);

      const original = await loadCurrentPlanSnapshot(sessionId, projectId);
      assert.equal(original.planVersion, 1);
      assert.ok(original.normalized);
      assert.equal(original.normalized.operations.length, 1);
      assert.equal(original.normalized.operations[0].type, 'add_module');

      const replayed = await replayJournal(projectId, {
        sessionId: `${sessionId}-clone`,
        replayProjectId: `${projectId}-clone`
      });

      assert.equal(replayed.journalLength, journal.length);
      assert.equal(replayed.planVersion, original.planVersion);
      assert.deepEqual(replayed.normalized, original.normalized);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it('fails the purity check when plan positions depend on wall-clock noise', async () => {
    const { normalizePlanSnapshot } = await import('./replay-journal.js');
    const base = {
      projectId: 'p',
      catalogSnapshotId: 'kitchen-demo-v1',
      planId: 'plan-a',
      createdAt: '2020-01-01T00:00:00.000Z',
      operations: [
        {
          type: 'add_module',
          sku: 'BASE-600',
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0
        }
      ]
    };
    const shifted = {
      ...base,
      planId: 'plan-b',
      createdAt: '2026-01-01T00:00:00.000Z',
      operations: [
        {
          type: 'add_module',
          sku: 'BASE-600',
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0
        }
      ]
    };
    assert.deepEqual(normalizePlanSnapshot(base), normalizePlanSnapshot(shifted));

    const drifted = {
      ...base,
      operations: [
        {
          type: 'add_module',
          sku: 'BASE-600',
          position: { x: Date.now() % 1000, y: 0, z: 0 },
          rotationY: 0
        }
      ]
    };
    assert.notDeepEqual(normalizePlanSnapshot(base), normalizePlanSnapshot(drifted));
  });
});
