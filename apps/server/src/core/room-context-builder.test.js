import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import { applySiteBindings } from './room-context-builder.js';

function baseSite(overrides = {}) {
  return {
    dimensions: {
      widthMm: 3000,
      depthMm: 4000,
      heightMm: 2700,
      ...overrides
    },
    walls: [],
    openings: [],
    utilities: []
  };
}

describe('applySiteBindings + manifest site', () => {
  before(() => {
    if (!registry.registeredTypes().includes('kitchen')) {
      registry.register(kitchenManifest);
    }
    if (!registry.registeredTypes().includes('desk')) {
      registry.register(deskManifest);
    }
  });

  it('is a no-op when siteBindings is empty or omitted', () => {
    const context = {
      roomShape: baseSite(),
      site: baseSite({ widthMm: 1111 })
    };

    const empty = applySiteBindings(
      { siteBindings: [] },
      context,
      { slots: { roomWidthMm: 9000 }, known: {} }
    );
    assert.equal(empty, context);

    const omitted = applySiteBindings(
      {},
      context,
      { slots: { roomWidthMm: 9000 }, known: {} }
    );
    assert.equal(omitted, context);

    const missingManifest = applySiteBindings(
      undefined,
      context,
      { slots: { roomWidthMm: 9000 }, known: {} }
    );
    assert.equal(missingManifest, context);
  });

  it('wires desk defaultSite independently from kitchen', () => {
    assert.equal(typeof kitchenManifest.defaultSite, 'function');
    assert.equal(typeof deskManifest.defaultSite, 'function');
    assert.notEqual(kitchenManifest.defaultSite, deskManifest.defaultSite);
    assert.notEqual(kitchenManifest.siteBindings, deskManifest.siteBindings);

    const kitchenSite = kitchenManifest.defaultSite();
    const deskSite = deskManifest.defaultSite();
    assert.deepEqual(kitchenSite.dimensions, {
      widthMm: 3000,
      depthMm: 4000,
      heightMm: 2700
    });
    assert.deepEqual(deskSite.dimensions, {
      widthMm: 3000,
      depthMm: 4000,
      heightMm: 2700
    });

    const context = {
      roomShape: structuredClone(deskSite),
      site: structuredClone(deskSite)
    };

    const kitchenOnlyManifest = {
      ...kitchenManifest,
      siteBindings: [{ slot: 'kitchenWidthMm', path: 'dimensions.widthMm' }]
    };
    const afterKitchen = applySiteBindings(kitchenOnlyManifest, context, {
      slots: { kitchenWidthMm: 1111, roomWidthMm: 9999 },
      known: {}
    });
    assert.equal(afterKitchen.site.dimensions.widthMm, 1111);
    assert.equal(afterKitchen.roomShape.dimensions.widthMm, 1111);
    assert.equal(context.site.dimensions.widthMm, 3000);

    const afterDesk = applySiteBindings(deskManifest, context, {
      slots: { roomWidthMm: 5000, kitchenWidthMm: 1111 },
      known: {}
    });
    assert.equal(afterDesk.site.dimensions.widthMm, 5000);
    assert.equal(afterDesk.roomShape.dimensions.widthMm, 5000);
    assert.equal(context.site.dimensions.widthMm, 3000);
  });

  it('keeps site and roomShape in sync when applying kitchen bindings', () => {
    const context = {
      roomShape: baseSite(),
      site: baseSite()
    };
    const next = applySiteBindings(kitchenManifest, context, {
      slots: { roomWidthMm: 3200 },
      known: { roomDepthMm: 4100 }
    });
    assert.equal(next.site.dimensions.widthMm, 3200);
    assert.equal(next.site.dimensions.depthMm, 4100);
    assert.equal(next.roomShape.dimensions.widthMm, 3200);
    assert.equal(next.roomShape.dimensions.depthMm, 4100);
    assert.equal(next.site, next.roomShape);
  });
});
