import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClientResponseSchema } from '@homecraft/contracts';
import { closeMongo } from '../storage/mongo.js';

describe('production export', () => {
  it('exports a PDF bound to plan version + catalog and returns identical bytes on re-export', async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-export-'));
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
    const sessionId = `sess-export-${Date.now()}`;
    const projectId = `proj-export-${Date.now()}`;
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
      await post('add module', 'req-ex-1');
      const first = await post('export pdf', 'req-ex-2');
      assert.equal(first.responseType, 'export');
      assert.ok(first.downloadUrl);
      assert.match(first.downloadUrl ?? '', /^\/api\/exports\//);
      assert.match(first.message ?? '', /plan v1/i);
      assert.match(first.message ?? '', /kitchen-demo-v1/);

      const exportId = first.downloadUrl.replace('/api/exports/', '');
      const pdfResponse = await fetch(
        `http://127.0.0.1:${address.port}/api/exports/${exportId}`
      );
      assert.equal(pdfResponse.status, 200);
      assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
      assert.equal(pdfResponse.headers.get('x-homecraft-plan-version'), '1');
      assert.equal(
        pdfResponse.headers.get('x-homecraft-catalog-snapshot'),
        'kitchen-demo-v1'
      );
      const pdfA = Buffer.from(await pdfResponse.arrayBuffer());
      assert.ok(pdfA.subarray(0, 4).equals(Buffer.from('%PDF')));

      const second = await post('export pdf', 'req-ex-3');
      assert.equal(second.responseType, 'export');
      assert.equal(second.downloadUrl, first.downloadUrl);

      const pdfResponse2 = await fetch(
        `http://127.0.0.1:${address.port}${second.downloadUrl}`
      );
      const pdfB = Buffer.from(await pdfResponse2.arrayBuffer());
      assert.deepEqual(pdfA, pdfB);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
