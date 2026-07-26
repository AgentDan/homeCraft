import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClientResponseSchema } from '@homecraft/contracts';
import { closeMongo } from '../storage/mongo.js';

/**
 * Characterization: locks the journal fields that finalizeResponse() writes for
 * each route() branch. Refactors must not change these without updating the tests.
 */
describe('orchestrator journal characterization', () => {
  /**
   * @param {string} prefix
   * @param {(helpers: {
   *   post: (command: string, requestId: string, options?: { expectedVersion?: number }) => Promise<{
   *     status: number,
   *     body: Record<string, any>
   *   }>,
   *   loadJournal: () => Promise<object[]>,
   *   sessionId: string,
   *   projectId: string,
   *   getExpectedVersion: () => number
   * }) => Promise<void>} run
   */
  async function withCommandServer(prefix, run) {
    const storageRoot = await mkdtemp(path.join(tmpdir(), `homecraft-${prefix}-`));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    const { createApp } = await import('../app.js');
    const { loadCommandJournal } = await import('../storage/local-storage.js');
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
    const sessionId = `sess-${prefix}-${Date.now()}`;
    const projectId = `proj-${prefix}-${Date.now()}`;
    let expectedVersion = 0;

    async function post(command, requestId, options = {}) {
      const version =
        options.expectedVersion !== undefined
          ? options.expectedVersion
          : expectedVersion;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          sessionId,
          projectId,
          command,
          expectedVersion: version,
          clientState: {}
        })
      });
      const body = await response.json();
      if (response.status === 200 && typeof body.planVersion === 'number') {
        expectedVersion = body.planVersion;
        ClientResponseSchema.parse(body);
      }
      return { status: response.status, body };
    }

    try {
      await run({
        post,
        loadJournal: () => loadCommandJournal(projectId),
        sessionId,
        projectId,
        getExpectedVersion: () => expectedVersion
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await closeMongo();
      await rm(storageRoot, { recursive: true, force: true });
    }
  }

  /**
   * @param {object} record
   * @param {{
   *   intentKind: string,
   *   outcomeKind: string,
   *   resultingVersion: number | null,
   *   compatibilityValid: boolean | null
   * }} expected
   */
  function assertJournalFields(record, expected) {
    assert.ok(record, 'expected a journal record');
    assert.equal(record.intentKind, expected.intentKind);
    assert.equal(record.outcomeKind, expected.outcomeKind);
    assert.equal(record.resultingVersion, expected.resultingVersion);
    assert.equal(record.compatibilityValid, expected.compatibilityValid);
  }

  it('records journal fields for applied, read-only, clarify, history, and export branches', async () => {
    await withCommandServer('journal-main', async ({ post, loadJournal }) => {
      const add = await post('add module', 'req-add');
      assert.equal(add.status, 200);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'add_module',
        outcomeKind: 'applied',
        resultingVersion: 1,
        compatibilityValid: true
      });

      const remove = await post('remove the last cabinet', 'req-remove');
      assert.equal(remove.status, 200);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'remove_module',
        outcomeKind: 'applied',
        resultingVersion: 2,
        compatibilityValid: true
      });

      // Re-add so later undo/redo and export have a non-empty plan.
      await post('add module', 'req-add-2');

      const price = await post('show price', 'req-price');
      assert.equal(price.status, 200);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'show_price',
        outcomeKind: 'read_only',
        resultingVersion: null,
        compatibilityValid: true
      });

      const budget = await post('budget 150000', 'req-budget');
      assert.equal(budget.status, 200);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'set_budget',
        outcomeKind: 'read_only',
        resultingVersion: null,
        compatibilityValid: true
      });

      const budgetClarify = await post('set a budget', 'req-budget-clarify');
      assert.equal(budgetClarify.status, 200);
      assert.equal(budgetClarify.body.responseType, 'clarify');
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'set_budget',
        outcomeKind: 'clarify',
        resultingVersion: null,
        compatibilityValid: null
      });

      const help = await post('help', 'req-help');
      assert.equal(help.status, 200);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'help',
        outcomeKind: 'read_only',
        resultingVersion: null,
        compatibilityValid: null
      });

      const unknown = await post('hello world', 'req-unknown');
      assert.equal(unknown.status, 200);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'unknown',
        outcomeKind: 'clarify',
        resultingVersion: null,
        compatibilityValid: null
      });

      // History after add→remove→add: versions 1, 2, 3; current is 3.
      const undo = await post('undo', 'req-undo');
      assert.equal(undo.status, 200);
      assert.equal(undo.body.planVersion, 2);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'undo',
        outcomeKind: 'applied',
        resultingVersion: 2,
        compatibilityValid: true
      });

      const redo = await post('redo', 'req-redo');
      assert.equal(redo.status, 200);
      assert.equal(redo.body.planVersion, 3);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'redo',
        outcomeKind: 'applied',
        resultingVersion: 3,
        compatibilityValid: true
      });

      const exported = await post('export pdf', 'req-export');
      assert.equal(exported.status, 200);
      assert.equal(exported.body.responseType, 'export');
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'export_project',
        outcomeKind: 'read_only',
        resultingVersion: null,
        compatibilityValid: null
      });
    });
  });

  it('records clarify journal fields for export_project on an empty plan', async () => {
    await withCommandServer('journal-export-empty', async ({ post, loadJournal }) => {
      const result = await post('export pdf', 'req-export-empty');
      assert.equal(result.status, 200);
      assert.equal(result.body.responseType, 'clarify');
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'export_project',
        outcomeKind: 'clarify',
        resultingVersion: null,
        compatibilityValid: null
      });
    });
  });

  it('records rejected journal fields when compatibility fails', async () => {
    await withCommandServer('journal-reject', async ({ post, loadJournal }) => {
      for (let index = 0; index < 5; index += 1) {
        const result = await post('add module', `req-fill-${index}`);
        assert.equal(result.status, 200);
        assert.equal(result.body.compatibility?.valid, true);
      }

      const rejected = await post('add module', 'req-reject');
      assert.equal(rejected.status, 200);
      assert.equal(rejected.body.compatibility?.valid, false);
      assertJournalFields((await loadJournal()).at(-1), {
        intentKind: 'add_module',
        outcomeKind: 'rejected',
        resultingVersion: null,
        compatibilityValid: false
      });
    });
  });

  it('does not append a journal record on 409 version_conflict', async () => {
    await withCommandServer('journal-409', async ({ post, loadJournal }) => {
      const first = await post('add module', 'req-409-first');
      assert.equal(first.status, 200);
      const journalAfterApply = await loadJournal();
      assert.equal(journalAfterApply.length, 1);

      const conflict = await post('add module', 'req-409-stale', {
        expectedVersion: 0
      });
      assert.equal(conflict.status, 409);
      assert.equal(conflict.body.code, 'version_conflict');

      const journalAfterConflict = await loadJournal();
      assert.equal(journalAfterConflict.length, 1);
      assert.deepEqual(journalAfterConflict[0], journalAfterApply[0]);
    });
  });
});
