import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ManufacturerCatalogSchema } from './index.js';

describe('@homecraft/catalog-schema smoke', () => {
  it('rejects empty module list', () => {
    assert.throws(() =>
      ManufacturerCatalogSchema.parse({
        manufacturerId: 'm1',
        catalogVersion: '1',
        modules: []
      })
    );
  });
});
