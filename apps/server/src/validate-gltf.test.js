import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadCatalogBySku,
  validateFile
} from '../scripts/validate-gltf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gltfDir = path.resolve(__dirname, '../gltf');

const PRIORITY = [
  'BASE-400',
  'BASE-600',
  'BASE-800',
  'WALL-600',
  'CORNER-900',
  'TALL-600',
  'SINK-600'
];

describe('validate-gltf', () => {
  it('accepts priority demo SKUs against catalog + authoring spec', async () => {
    const catalog = loadCatalogBySku();
    for (const sku of PRIORITY) {
      const filePath = path.join(gltfDir, `${sku}.glb`);
      assert.equal(existsSync(filePath), true, `missing ${sku}.glb`);
      const result = await validateFile(filePath, catalog);
      assert.equal(result.ok, true, `${sku}: ${result.errors.join('; ')}`);
    }
  });

  it('reports missing file without throwing', async () => {
    const catalog = loadCatalogBySku();
    const result = await validateFile(
      path.join(gltfDir, 'NO-SUCH-SKU.glb'),
      catalog
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /missing/i.test(e)));
  });
});
