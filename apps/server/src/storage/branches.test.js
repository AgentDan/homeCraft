import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClientResponseSchema } from '@homecraft/contracts';
import { closeMongo } from '../storage/mongo.js';

describe('plan branches', () => {
  it('keeps distinct scenes and estimates across two branches', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-branches-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('../app.js');
    const app = createApp();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const endpoint = `http://127.0.0.1:${address.port}/api/commands`;

    const sessionId = `sess-branches-${Date.now()}`;
    const projectId = `proj-branches-${Date.now()}`;
    let expectedVersion = 0;
    let requestSeq = 0;

    /**
     * @param {string} command
     */
    async function post(command) {
      requestSeq += 1;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: `req-branch-${requestSeq}`,
          sessionId,
          projectId,
          command,
          language: 'en',
          expectedVersion,
          clientState: {}
        })
      });
      const body = ClientResponseSchema.parse(await response.json());
      assert.equal(response.status, 200);
      if (typeof body.planVersion === 'number') {
        expectedVersion = body.planVersion;
      }
      return body;
    }

    try {
      const base = await post('add base cabinet 600');
      assert.equal(base.planVersion, 1);
      assert.equal(base.branchId, 'main');
      assert.equal(base.sceneResult?.modules.length, 1);
      const baseTotal = base.bom?.totalEur ?? 0;
      assert.ok(baseTotal > 0);

      const forked = await post('create branch alt');
      assert.equal(forked.branchId, 'alt');
      assert.equal(forked.planVersion, 1);
      assert.equal(forked.sceneResult?.modules.length, 1);

      const onAlt = await post('add sink cabinet 800');
      assert.equal(onAlt.branchId, 'alt');
      assert.equal(onAlt.planVersion, 2);
      assert.equal(onAlt.sceneResult?.modules.length, 2);
      const altTotal = onAlt.bom?.totalEur ?? 0;
      assert.ok(altTotal > baseTotal);

      const backToMain = await post('switch branch main');
      assert.equal(backToMain.branchId, 'main');
      assert.equal(backToMain.planVersion, 1);
      assert.equal(backToMain.sceneResult?.modules.length, 1);
      assert.equal(backToMain.bom?.totalEur, baseTotal);

      const onMain = await post('add wall cabinet 600');
      assert.equal(onMain.branchId, 'main');
      assert.equal(onMain.planVersion, 3);
      assert.equal(onMain.sceneResult?.modules.length, 2);
      const mainTotal = onMain.bom?.totalEur ?? 0;
      assert.notEqual(mainTotal, altTotal);

      const againAlt = await post('switch branch alt');
      assert.equal(againAlt.branchId, 'alt');
      assert.equal(againAlt.planVersion, 2);
      assert.equal(againAlt.sceneResult?.modules.length, 2);
      assert.equal(againAlt.bom?.totalEur, altTotal);

      const { loadCommandJournal, loadPlanHistory } = await import(
        '../storage/local-storage.js'
      );
      const journal = await loadCommandJournal(projectId);
      assert.ok(
        journal.some((record) => record.intentKind === 'create_branch')
      );
      assert.ok(
        journal.some((record) => record.intentKind === 'switch_branch')
      );

      const history = await loadPlanHistory(sessionId, projectId);
      assert.equal(history.branches.length, 2);
      assert.equal(history.activeBranchId, 'alt');
      assert.equal(history.entries.length, 3);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo().catch(() => {});
      await rm(storageRoot, { recursive: true, force: true });
      delete process.env.SERVER_STORAGE_DIR;
    }
  });
});
