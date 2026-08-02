#!/usr/bin/env node
/**
 * Homecraft demo glTF authoring — kitchen cabinets (not app codegen).
 * Carcass shell + shelves + plinth + facade doors + inset handles.
 * Keeps catalog bbox, center origin, +Z facade, materials facade/carcass.
 *
 *   node scripts/author-demo-glb.mjs
 *   node scripts/author-demo-glb.mjs --force
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Accessor, Document, NodeIO } from '@gltf-transform/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const gltfDir = path.join(serverRoot, 'gltf');
const catalogPath = path.join(
  serverRoot,
  'src/knowledge-base/data/source/kitchen-catalog.json'
);

const PRIORITY_SKUS = [
  'BASE-400',
  'BASE-600',
  'BASE-800',
  'WALL-600',
  'CORNER-900',
  'TALL-600',
  'SINK-600'
];

const PANEL = 0.018;
const FACADE_T = 0.018;
const PLINTH_H = 0.1;

function boxArrays(x0, y0, z0, x1, y1, z1) {
  const positions = new Float32Array([
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
    x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1,
    x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1,
    x0, y0, z0, x0, y1, z0, x0, y1, z1, x0, y0, z1,
    x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    8, 9, 10, 8, 10, 11,
    12, 14, 13, 12, 15, 14,
    16, 17, 18, 16, 18, 19,
    20, 22, 21, 20, 23, 22
  ]);
  return { positions, indices };
}

function addBox(document, mesh, material, x0, y0, z0, x1, y1, z1) {
  const { positions, indices } = boxArrays(x0, y0, z0, x1, y1, z1);
  const posAcc = document
    .createAccessor()
    .setType(Accessor.Type.VEC3)
    .setArray(positions);
  const idxAcc = document
    .createAccessor()
    .setType(Accessor.Type.SCALAR)
    .setArray(indices);
  mesh.addPrimitive(
    document
      .createPrimitive()
      .setAttribute('POSITION', posAcc)
      .setIndices(idxAcc)
      .setMaterial(material)
  );
}

function addInsetHandle(document, mesh, material, x, y, z1, horizontal) {
  const depth = 0.012;
  const z0 = z1 - depth - 0.002;
  const zOut = z1 - 0.001;
  if (horizontal) {
    const len = 0.12;
    const thick = 0.012;
    addBox(document, mesh, material, x - len / 2, y - thick / 2, z0, x + len / 2, y + thick / 2, zOut);
  } else {
    const len = 0.14;
    const thick = 0.012;
    addBox(document, mesh, material, x - thick / 2, y - len / 2, z0, x + thick / 2, y + len / 2, zOut);
  }
}

function buildModuleDocument(dimensions, sku) {
  const w = dimensions.widthMm / 1000;
  const h = dimensions.heightMm / 1000;
  const d = dimensions.depthMm / 1000;

  const document = new Document();
  const buffer = document.createBuffer();
  const carcass = document
    .createMaterial('carcass')
    .setBaseColorFactor([0.55, 0.5, 0.45, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.75);
  const facade = document
    .createMaterial('facade')
    .setBaseColorFactor([0.94, 0.94, 0.92, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.62);

  const mesh = document.createMesh(sku);
  const t = Math.min(PANEL, w * 0.08, d * 0.08);
  const ft = Math.min(FACADE_T, d * 0.2);
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const innerZ1 = z1 - ft;

  const isWall = sku.startsWith('WALL');
  const isTall = sku.startsWith('TALL');
  const isCorner = sku.startsWith('CORNER');
  const isSink = sku.startsWith('SINK');
  const plinth = !isWall;
  const plinthH = plinth ? Math.min(PLINTH_H, h * 0.16) : 0;
  const doorY0 = y0 + plinthH;
  const doorH = y1 - doorY0;
  const gap = 0.002;

  addBox(document, mesh, carcass, x0, y0, z0, x1, y1, z0 + t);
  addBox(document, mesh, carcass, x0, y0, z0, x0 + t, y1, innerZ1);
  addBox(document, mesh, carcass, x1 - t, y0, z0, x1, y1, innerZ1);
  addBox(document, mesh, carcass, x0, y0, z0, x1, y0 + t, innerZ1);
  addBox(document, mesh, carcass, x0, y1 - t, z0, x1, y1, innerZ1);

  if (plinth) {
    const recess = Math.min(0.035, d * 0.07);
    addBox(document, mesh, carcass, x0 + t * 0.4, y0, z0 + t, x1 - t * 0.4, y0 + plinthH, innerZ1 - recess);
  }

  const shelfCount = isTall ? 3 : 1;
  for (let i = 1; i <= shelfCount; i += 1) {
    const yy = doorY0 + (doorH * i) / (shelfCount + 1);
    addBox(document, mesh, carcass, x0 + t, yy - t * 0.35, z0 + t, x1 - t, yy + t * 0.35, innerZ1 - t * 0.5);
  }

  if (isSink) {
    const cutW = w * 0.5;
    const cutD = Math.min(0.28, (innerZ1 - z0) * 0.45);
    addBox(document, mesh, carcass, -cutW / 2, y1 - t * 1.8, -cutD / 2 - 0.02, cutW / 2, y1 - t * 0.15, cutD / 2 - 0.02);
  }

  if (isCorner) {
    const wing = Math.min(w, d) * 0.4;
    addBox(document, mesh, carcass, x0 + t, doorY0, z0 + t, x0 + wing, y1 - t, z0 + wing);
  }

  const doubleDoor = (sku.startsWith('BASE') && w >= 0.75) || isCorner;
  if (doubleDoor) {
    addBox(document, mesh, facade, x0 + gap, doorY0 + gap, innerZ1, -gap * 0.5, y1 - gap, z1);
    addBox(document, mesh, facade, gap * 0.5, doorY0 + gap, innerZ1, x1 - gap, y1 - gap, z1);
    addInsetHandle(document, mesh, carcass, -w * 0.2, doorY0 + doorH * 0.52, z1, true);
    addInsetHandle(document, mesh, carcass, w * 0.2, doorY0 + doorH * 0.52, z1, true);
  } else if (isTall) {
    const midY = doorY0 + doorH * 0.5;
    addBox(document, mesh, facade, x0 + gap, doorY0 + gap, innerZ1, x1 - gap, midY - gap * 0.5, z1);
    addBox(document, mesh, facade, x0 + gap, midY + gap * 0.5, innerZ1, x1 - gap, y1 - gap, z1);
    addInsetHandle(document, mesh, carcass, w * 0.3, doorY0 + doorH * 0.28, z1, false);
    addInsetHandle(document, mesh, carcass, w * 0.3, doorY0 + doorH * 0.72, z1, false);
  } else {
    addBox(document, mesh, facade, x0 + gap, doorY0 + gap, innerZ1, x1 - gap, y1 - gap, z1);
    const vertical = w < 0.5;
    addInsetHandle(document, mesh, carcass, vertical ? w * 0.3 : 0, doorY0 + doorH * (vertical ? 0.5 : 0.55), z1, !vertical);
  }

  for (const acc of document.getRoot().listAccessors()) {
    acc.setBuffer(buffer);
  }
  document.createScene(sku).addChild(document.createNode(sku).setMesh(mesh));
  return document;
}

async function main() {
  const force = process.argv.includes('--force');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const bySku = new Map(catalog.modules.map((m) => [m.sku, m]));
  const io = new NodeIO();
  let written = 0;
  let skipped = 0;

  for (const sku of PRIORITY_SKUS) {
    const mod = bySku.get(sku);
    if (!mod) {
      console.error('SKIP ' + sku + ': not in catalog');
      skipped += 1;
      continue;
    }
    const outPath = path.join(gltfDir, sku + '.glb');
    if (existsSync(outPath) && !force) {
      console.log('KEEP ' + sku + ': exists (pass --force to replace)');
      skipped += 1;
      continue;
    }
    const document = buildModuleDocument(mod.dimensions, sku);
    const bytes = await io.writeBinary(document);
    writeFileSync(outPath, Buffer.from(bytes));
    console.log('WRITE ' + sku + ' (' + bytes.byteLength + ' bytes)');
    written += 1;
  }

  console.log('\nDone. written=' + written + ' skipped=' + skipped);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
