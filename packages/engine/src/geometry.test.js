import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { boundingBox, boxesOverlap, centerXZ, footprint } from './geometry.js';

/**
 * @param {{
 *   x?: number, y?: number, z?: number,
 *   widthMm?: number, heightMm?: number, depthMm?: number,
 *   rotationY?: number
 * }} [overrides]
 */
function placed(overrides = {}) {
  return {
    position: {
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      z: overrides.z ?? 0
    },
    dimensions: {
      widthMm: overrides.widthMm ?? 800,
      heightMm: overrides.heightMm ?? 720,
      depthMm: overrides.depthMm ?? 560
    },
    rotationY: overrides.rotationY ?? 0
  };
}

describe('@homecraft/engine geometry', () => {
  it('keeps width/depth at rotation 0 and 180, swaps them at 90 and 270', () => {
    const module = placed({ widthMm: 800, depthMm: 560 });
    assert.deepEqual(footprint({ ...module, rotationY: 0 }), { widthMm: 800, depthMm: 560 });
    assert.deepEqual(footprint({ ...module, rotationY: 180 }), { widthMm: 800, depthMm: 560 });
    assert.deepEqual(footprint({ ...module, rotationY: 90 }), { widthMm: 560, depthMm: 800 });
    assert.deepEqual(footprint({ ...module, rotationY: 270 }), { widthMm: 560, depthMm: 800 });
  });

  it('builds a bounding box from position plus rotated footprint', () => {
    const box = boundingBox(placed({ x: 100, y: 0, z: 200, widthMm: 800, heightMm: 720, depthMm: 560, rotationY: 90 }));
    assert.deepEqual(box, {
      minX: 100,
      maxX: 660,
      minY: 0,
      maxY: 720,
      minZ: 200,
      maxZ: 1000
    });
  });

  it('detects overlapping volumes and ignores face-touching or separated boxes', () => {
    const left = boundingBox(placed({ x: 0, widthMm: 800, depthMm: 560 }));
    const overlapping = boundingBox(placed({ x: 400, widthMm: 800, depthMm: 560 }));
    const touching = boundingBox(placed({ x: 800, widthMm: 400, depthMm: 560 }));
    const apart = boundingBox(placed({ x: 900, widthMm: 400, depthMm: 560 }));

    assert.equal(boxesOverlap(left, overlapping), true);
    assert.equal(boxesOverlap(left, touching), false);
    assert.equal(boxesOverlap(left, apart), false);
  });

  it('places centerXZ at the midpoint of the rotated footprint', () => {
    assert.deepEqual(
      centerXZ(placed({ x: 100, z: 200, widthMm: 800, depthMm: 560, rotationY: 0 })),
      { x: 500, z: 480 }
    );
    assert.deepEqual(
      centerXZ(placed({ x: 100, z: 200, widthMm: 800, depthMm: 560, rotationY: 90 })),
      { x: 380, z: 600 }
    );
  });
});
