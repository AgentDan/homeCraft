import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CommandRecordSchema } from '@homecraft/contracts';

describe('command journal', () => {
  /** @type {string} */
  let storageRoot;
  /** @type {typeof import('./local-storage.js')} */
  let storage;

  before(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'homecraft-journal-'));
    process.env.SERVER_STORAGE_DIR = storageRoot;
    storage = await import('./local-storage.js');
    await storage.ensureStorage();
  });

  after(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('appends two records with sequential seq and preserves rawInput', async () => {
    const projectId = `proj-journal-${Date.now()}`;
    const base = {
      projectId,
      sessionId: 'sess-journal',
      inputChannel: /** @type {const} */ ('text'),
      language: /** @type {const} */ ('en'),
      intentKind: 'add_module',
      outcomeKind: /** @type {const} */ ('applied'),
      compatibilityValid: true,
      resultingVersion: 1,
      catalogSnapshotId: 'kitchen-demo-v1',
      createdAt: new Date().toISOString()
    };

    const first = await storage.appendCommandRecord({
      ...base,
      requestId: 'req-1',
      seq: await storage.getNextCommandSeq(projectId),
      rawInput: 'add base cabinet 600'
    });
    const second = await storage.appendCommandRecord({
      ...base,
      requestId: 'req-2',
      seq: await storage.getNextCommandSeq(projectId),
      rawInput: 'undo',
      intentKind: 'undo',
      resultingVersion: 0
    });

    const journal = await storage.loadCommandJournal(projectId);
    assert.equal(journal.length, 2);
    assert.equal(journal[0].seq, 1);
    assert.equal(journal[1].seq, 2);
    assert.equal(journal[0].rawInput, 'add base cabinet 600');
    assert.equal(journal[1].rawInput, 'undo');
    assert.equal(first.seq, 1);
    assert.equal(second.seq, 2);
  });

  it('rejects records that fail CommandRecordSchema', async () => {
    await assert.rejects(() =>
      storage.appendCommandRecord({
        requestId: 'req-bad',
        projectId: 'proj-bad',
        sessionId: 'sess-bad',
        seq: 1,
        rawInput: 'x',
        inputChannel: 'text',
        language: 'en',
        intentKind: 'add_module',
        outcomeKind: 'not-a-real-outcome',
        compatibilityValid: true,
        resultingVersion: 1,
        catalogSnapshotId: 'kitchen-demo-v1',
        createdAt: new Date().toISOString()
      })
    );
  });

  it('skips a corrupt middle line when reading the journal', async () => {
    const projectId = `proj-corrupt-${Date.now()}`;
    const filePath = path.join(
      storageRoot,
      'action-history',
      `${projectId}.jsonl`
    );
    const good = CommandRecordSchema.parse({
      requestId: 'req-a',
      projectId,
      sessionId: 'sess-a',
      seq: 1,
      rawInput: 'help',
      inputChannel: 'text',
      language: 'en',
      intentKind: 'help',
      outcomeKind: 'read_only',
      compatibilityValid: null,
      resultingVersion: null,
      catalogSnapshotId: 'kitchen-demo-v1',
      createdAt: new Date().toISOString()
    });
    const good2 = CommandRecordSchema.parse({
      ...good,
      requestId: 'req-b',
      seq: 2,
      rawInput: 'show price',
      intentKind: 'show_price'
    });
    await writeFile(
      filePath,
      `${JSON.stringify(good)}\n{not-json\n${JSON.stringify(good2)}\n`
    );

    const journal = await storage.loadCommandJournal(projectId);
    assert.equal(journal.length, 2);
    assert.equal(journal[0].requestId, 'req-a');
    assert.equal(journal[1].requestId, 'req-b');
  });
});
