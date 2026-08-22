import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ManufacturerCatalogSchema, normalizeCatalog } from '@homecraft/catalog-schema';
import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import { generatePlan } from '../ai-services/configuration-plan-generator.js';
import { retrieve } from '../ai-services/catalog-rag-retriever.js';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';
import { getCatalogSnapshot, listCatalogSnapshots } from './catalog-store.js';

const DESK_CATALOG_PATH = fileURLToPath(
  new URL('./data/source/desk-catalog.json', import.meta.url)
);

function deskRoomContext() {
  return {
    projectId: 'proj-desk',
    sessionId: 'sess-desk',
    productType: 'desk',
    catalogSnapshotId: 'desk-demo-v1',
    roomShape: {
      dimensions: { widthMm: 4000, depthMm: 4000, heightMm: 2700 },
      walls: [],
      openings: [],
      utilities: []
    },
    dialogTurns: [],
    updatedAt: new Date().toISOString()
  };
}

describe('per-domain catalog store', () => {
  before(() => {
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(deskManifest);
    }
  });

  it('validates desk-catalog.json against ManufacturerCatalogSchema', async () => {
    const raw = JSON.parse(await readFile(DESK_CATALOG_PATH, 'utf8'));
    const parsed = ManufacturerCatalogSchema.parse(raw);
    const normalized = normalizeCatalog(raw);
    assert.equal(parsed.catalogVersion, 'desk-demo-v1');
    assert.equal(normalized.modules.length, parsed.modules.length);
    assert.ok(parsed.modules.some((module) => module.sku === 'DESK-1200'));
    const desk1200 = parsed.modules.find((module) => module.sku === 'DESK-1200');
    assert.deepEqual(desk1200?.dimensions, {
      widthMm: 1200,
      heightMm: 750,
      depthMm: 600
    });
    assert.equal(desk1200?.mounting, 'floor');
  });

  it('loads kitchen and desk snapshots from different files', async () => {
    const kitchen = await getCatalogSnapshot('kitchen-demo-v1', 'kitchen');
    const desk = await getCatalogSnapshot('desk-demo-v1', 'desk');
    assert.equal(kitchen.catalogVersion, 'kitchen-demo-v1');
    assert.equal(desk.catalogVersion, 'desk-demo-v1');
    assert.ok(kitchen.modules.some((module) => module.sku === 'BASE-600'));
    assert.ok(desk.modules.some((module) => module.sku === 'DESK-1200'));
    assert.ok(!kitchen.modules.some((module) => module.sku.startsWith('DESK-')));
    assert.ok(!desk.modules.some((module) => module.sku.startsWith('BASE-')));

    await assert.rejects(
      () => getCatalogSnapshot('desk-demo-v1', 'kitchen'),
      /Catalog snapshot "desk-demo-v1" was not found/
    );

    const kitchenList = await listCatalogSnapshots('kitchen');
    const deskList = await listCatalogSnapshots('desk');
    assert.equal(kitchenList[0].id, 'kitchen-demo-v1');
    assert.equal(kitchenList[0].default, true);
    assert.equal(deskList[0].id, 'desk-demo-v1');
    assert.equal(deskList[0].default, true);
    assert.ok(kitchenList[0].moduleCount >= 15);
    assert.equal(deskList[0].moduleCount, 4);
  });

  it('runs a real desk plan through generatePlan → materializePlan → assertCompatible → calculateBOM', async () => {
    const catalog = await getCatalogSnapshot('desk-demo-v1', 'desk');
    const { plan, outcome } = await generatePlan({
      intent: {
        kind: 'add_module',
        confidence: 1,
        language: 'en',
        rawText: 'add DESK-1200',
        slots: { sku: 'DESK-1200' }
      },
      context: {
        projectId: 'proj-desk',
        productType: 'desk',
        catalogSnapshotId: 'desk-demo-v1',
        planOperations: []
      },
      candidates: catalog.modules,
      dialogText: 'add DESK-1200'
    });

    assert.equal(outcome.kind, 'applied');
    assert.equal(plan.productType, 'desk');
    assert.equal(plan.catalogSnapshotId, 'desk-demo-v1');
    assert.equal(plan.operations[0].sku, 'DESK-1200');

    const modules = await materializePlan(plan);
    assert.equal(modules.length, 1);
    assert.equal(modules[0].sku, 'DESK-1200');
    assert.equal(modules[0].category, 'desk');
    assert.deepEqual(modules[0].dimensions, {
      widthMm: 1200,
      heightMm: 750,
      depthMm: 600
    });

    const compatibility = await deskManifest.assertCompatible(plan, deskRoomContext());
    assert.equal(compatibility.valid, true);

    const bom = await deskManifest.calculateBOM(plan, plan.catalogSnapshotId);
    assert.equal(bom.lines[0].sku, 'DESK-1200');
    assert.equal(bom.totalEur, 24900);
  });

  it('retrieve() returns desk modules from the desk index and kitchen modules from kitchen', async () => {
    const deskHits = await retrieve('desk 1200', 'desk-demo-v1', 5, {}, 'desk');
    assert.ok(deskHits.length > 0);
    assert.ok(deskHits.every((module) => module.source === 'catalog:desk-demo-v1'));
    assert.ok(deskHits.some((module) => module.sku === 'DESK-1200'));
    assert.ok(deskHits.every((module) => !module.sku.startsWith('BASE-')));

    const kitchenHits = await retrieve('cabinet', 'kitchen-demo-v1', 5, {}, 'kitchen');
    assert.ok(kitchenHits.length > 0);
    assert.ok(kitchenHits.every((module) => module.source === 'catalog:kitchen-demo-v1'));
    assert.ok(kitchenHits.every((module) => !module.sku.startsWith('DESK-')));

    await assert.rejects(
      () => retrieve('desk', 'desk-demo-v1', 5, {}, 'kitchen'),
      /Catalog index "desk-demo-v1" was not found/
    );
  });
});
