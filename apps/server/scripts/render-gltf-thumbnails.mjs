#!/usr/bin/env node
/**
 * One-shot: render `/gltf/{sku}.png` from `{sku}.glb`.
 * Loads meshes with three.js GLTFLoader (same engine family as ScenePreview),
 * then draws a fixed isometric-ish facade view to an offscreen canvas.
 * Does not overwrite existing PNGs (snapshot immutability).
 *
 *   npm run render:gltf-thumbs --workspace @homecraft/server
 *   npm run render:gltf-thumbs --workspace @homecraft/server -- BASE-600
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { Box3, Color, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gltfDir = path.resolve(__dirname, '../gltf');
const WIDTH = 256;
const HEIGHT = 192;

/**
 * @param {string} glbPath
 * @returns {Promise<import('three').Group>}
 */
function loadGltfRoot(glbPath) {
  const buffer = readFileSync(glbPath);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ),
      '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(err)
    );
  });
}

/**
 * @param {string} hex
 * @param {number} factor
 */
function shade(hex, factor) {
  const c = new Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

/**
 * Fixed-angle thumbnail: +Z facade toward camera, carcass as depth cue.
 * @param {import('three').Object3D} root
 * @returns {Buffer}
 */
function renderThumbnail(root) {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1216';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let facade = '#f5f5f4';
  let carcass = '#8c8c86';
  root.traverse((obj) => {
    if (!('isMesh' in obj) || !obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat?.color) continue;
      const hex = `#${mat.color.getHexString()}`;
      if (mat.name === 'facade') facade = hex;
      if (mat.name === 'carcass') carcass = hex;
    }
  });

  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const scale = (Math.min(WIDTH, HEIGHT) * 0.55) / maxDim;
  const cx = WIDTH * 0.52;
  const cy = HEIGHT * 0.62;
  const w = size.x * scale;
  const h = size.y * scale;
  const d = size.z * scale;
  const skew = 0.45;

  ctx.fillStyle = carcass;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.lineTo(cx - w / 2 + d * skew, cy - d * skew);
  ctx.lineTo(cx - w / 2 + d * skew, cy - d * skew - h);
  ctx.lineTo(cx - w / 2, cy - h);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h);
  ctx.lineTo(cx - w / 2 + d * skew, cy - d * skew - h);
  ctx.lineTo(cx + w / 2 + d * skew, cy - d * skew - h);
  ctx.lineTo(cx + w / 2, cy - h);
  ctx.closePath();
  ctx.fillStyle = shade(carcass, 1.08);
  ctx.fill();

  ctx.fillStyle = facade;
  ctx.fillRect(cx - w / 2, cy - h, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, cy - h, w, h);

  return canvas.toBuffer('image/png');
}

/**
 * @param {string | undefined} arg
 * @returns {string[]}
 */
function listTargets(arg) {
  if (arg) {
    const sku = arg.replace(/\.glb$/i, '');
    return [path.join(gltfDir, `${sku}.glb`)];
  }
  return readdirSync(gltfDir)
    .filter((name) => name.endsWith('.glb'))
    .map((name) => path.join(gltfDir, name))
    .sort();
}

async function main() {
  const arg = process.argv[2];
  const targets = listTargets(arg);
  if (targets.length === 0) {
    console.error('No .glb files found.');
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;
  for (const glbPath of targets) {
    if (!existsSync(glbPath)) {
      console.error(`MISSING ${glbPath}`);
      skipped += 1;
      continue;
    }
    const sku = path.basename(glbPath, '.glb');
    const outPath = path.join(gltfDir, `${sku}.png`);
    if (existsSync(outPath)) {
      console.log(`KEEP ${sku}.png (immutable)`);
      skipped += 1;
      continue;
    }
    const root = await loadGltfRoot(glbPath);
    const png = renderThumbnail(root);
    writeFileSync(outPath, png);
    console.log(`WRITE ${sku}.png (${png.length} bytes)`);
    written += 1;
  }
  console.log(`\nDone. written=${written} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
