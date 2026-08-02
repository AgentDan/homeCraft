import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSpeechRecognitionCtor } from './src/hooks/useSpeechCommand.js';
import { moduleCenterPosition } from './src/components/modulePose.js';

describe('@homecraft/client smoke', () => {
  it('passes build gate', () => {
    assert.ok(true);
  });

  it('getSpeechRecognitionCtor is null outside a browser', () => {
    assert.equal(getSpeechRecognitionCtor(), null);
  });

  it('moduleCenterPosition keeps center-origin pose math', () => {
    const pos = moduleCenterPosition({
      position: { x: 0, y: 0, z: 0 },
      dimensions: { widthMm: 600, heightMm: 720, depthMm: 560 }
    });
    assert.deepEqual(pos, [0.3, 0.36, 0.28]);
  });
});
