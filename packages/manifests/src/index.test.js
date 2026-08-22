import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allManifests, kitchenManifest, deskManifest } from './index.js';

describe('@homecraft/manifests allManifests', () => {
  it('lists kitchen then desk as the known domains', () => {
    assert.equal(allManifests.length, 2);
    assert.equal(allManifests[0], kitchenManifest);
    assert.equal(allManifests[1], deskManifest);
    assert.deepEqual(
      allManifests.map((manifest) => manifest.productType),
      ['kitchen', 'desk']
    );
  });
});
