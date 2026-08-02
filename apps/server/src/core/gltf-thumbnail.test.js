import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkuThumbnailUrl } from './gltf-thumbnail.js';

describe('resolveSkuThumbnailUrl', () => {
  it('returns /gltf/{sku}.png for priority SKUs with thumbnails', () => {
    assert.equal(resolveSkuThumbnailUrl('BASE-600'), '/gltf/BASE-600.png');
  });

  it('returns undefined when PNG is missing', () => {
    assert.equal(resolveSkuThumbnailUrl('NO-SUCH-SKU'), undefined);
    assert.equal(resolveSkuThumbnailUrl(''), undefined);
    assert.equal(resolveSkuThumbnailUrl(null), undefined);
  });
});
