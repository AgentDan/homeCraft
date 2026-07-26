import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClientResponseSchema } from '@homecraft/contracts';
import { closeMongo } from './mongo.js';

describe('idempotency and optimistic locking', () => {
  it('returns 409 when expectedVersion does not match', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-lock-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('../app.js');
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
    const sessionId = `sess-lock-${Date.now()}`;
    const projectId = `proj-lock-${Date.now()}`;

    try {
      const first = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'req-lock-1',
          sessionId,
          projectId,
          command: 'add module',
          expectedVersion: 0,
          clientState: {}
        })
      });
      assert.equal(first.status, 200);
      const firstBody = ClientResponseSchema.parse(await first.json());
      assert.equal(firstBody.planVersion, 1);

      const conflict = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'req-lock-stale',
          sessionId,
          projectId,
          command: 'add module',
          expectedVersion: 0,
          clientState: {}
        })
      });
      assert.equal(conflict.status, 409);
      const body = await conflict.json();
      assert.equal(body.code, 'version_conflict');
      assert.equal(body.currentVersion, 1);
      assert.equal(body.expectedVersion, 0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it('replays the same requestId without bumping version twice', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-idem-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('../app.js');
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
    const sessionId = `sess-idem-${Date.now()}`;
    const projectId = `proj-idem-${Date.now()}`;
    const payload = {
      requestId: 'req-idem-same',
      sessionId,
      projectId,
      command: 'add module',
      expectedVersion: 0,
      clientState: {}
    };

    try {
      const firstResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      assert.equal(firstResponse.status, 200);
      const first = ClientResponseSchema.parse(await firstResponse.json());
      assert.equal(first.planVersion, 1);

      const secondResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      assert.equal(secondResponse.status, 200);
      const second = ClientResponseSchema.parse(await secondResponse.json());
      assert.equal(second.planVersion, 1);
      assert.equal(second.requestId, first.requestId);
      assert.equal(second.plan?.operations.length, first.plan?.operations.length);

      const { getCurrentPlanVersion } = await import('./local-storage.js');
      assert.equal(await getCurrentPlanVersion(sessionId, projectId), 1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it('accepts only one of two parallel requests with the same expectedVersion', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-race-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('../app.js');
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
    const sessionId = `sess-race-${Date.now()}`;
    const projectId = `proj-race-${Date.now()}`;

    try {
      const [a, b] = await Promise.all([
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: 'req-race-a',
            sessionId,
            projectId,
            command: 'add module',
            expectedVersion: 0,
            clientState: {}
          })
        }),
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: 'req-race-b',
            sessionId,
            projectId,
            command: 'add module',
            expectedVersion: 0,
            clientState: {}
          })
        })
      ]);

      const statuses = [a.status, b.status].sort();
      assert.deepEqual(statuses, [200, 409]);

      const { getCurrentPlanVersion } = await import('./local-storage.js');
      assert.equal(await getCurrentPlanVersion(sessionId, projectId), 1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
