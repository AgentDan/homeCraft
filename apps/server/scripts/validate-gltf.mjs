#!/usr/bin/env node
/**
 * Validate Homecraft kitchen `.glb` files against docs/model-authoring-spec.md
 * and catalog dimensions for kitchen-demo-v1.
 *
 * Usage:
 *   node scripts/validate-gltf.mjs
 *   node scripts/validate-gltf.mjs BASE-600
 *   node scripts/validate-gltf.mjs path/to/BASE-600.glb
 *
 * Exit 0 = all ok; 1 = failures.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const gltfDir = path.join(serverRoot, 'gltf');
const catalogPath = path.join(
  serverRoot,
  'src/knowledge-base/data/source/kitchen-catalog.json'
);

/** @see docs/model-authoring-spec.md */
const MAX_TRIANGLES = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;
/** Hardware / handle overhang tolerance vs catalog bbox (metres). */
const BBOX_TOLERANCE_M = 0.01;
/** Origin must sit at geometric centre of bbox (metres). */
const ORIGIN_TOLERANCE_M = 0.002;
const REQUIRED_SLOTS = /** @type {const} */ (['facade', 'carcass']);
const ROUGHNESS_MIN = 0.55;
const ROUGHNESS_MAX = 0.85;
const METALNESS_MAX = 0.05;

/**
 * @typedef {{
 *   sku: string,
 *   dimensions: { widthMm: number, heightMm: number, depthMm: number }
 * }} CatalogModule
 */

/** @returns {Map<string, CatalogModule>} */
function loadCatalogBySku() {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  /** @type {Map<string, CatalogModule>} */
  const map = new Map();
  for (const mod of catalog.modules) {
    map.set(mod.sku, mod);
  }
  return map;
}

/**
 * @param {string} arg
 * @returns {string[]} absolute paths to .glb files
 */
function resolveTargets(arg) {
  if (!arg) {
    if (!existsSync(gltfDir)) return [];
    return readdirSync(gltfDir)
      .filter((name) => name.endsWith('.glb'))
      .map((name) => path.join(gltfDir, name))
      .sort();
  }
  if (arg.endsWith('.glb') || arg.includes(path.sep) || arg.includes('/')) {
    return [path.resolve(arg)];
  }
  return [path.join(gltfDir, `${arg}.glb`)];
}

/**
 * @param {import('@gltf-transform/core').Document} document
 * @returns {number}
 */
function countTriangles(document) {
  let tris = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) {
        tris += Math.floor(indices.getCount() / 3);
        continue;
      }
      const pos = prim.getAttribute('POSITION');
      if (pos) tris += Math.floor(pos.getCount() / 3);
    }
  }
  return tris;
}

/**
 * @param {import('@gltf-transform/core').Document} document
 * @returns {Set<string>}
 */
function materialNames(document) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const mat of document.getRoot().listMaterials()) {
    const name = mat.getName()?.trim();
    if (name) names.add(name);
  }
  return names;
}

/**
 * Soft check: centroid of geometry using material `facade` should prefer +Z half-space.
 * @param {import('@gltf-transform/core').Document} document
 * @returns {{ ok: boolean, detail: string }}
 */
function checkFacadeFacesPlusZ(document) {
  /** @type {number[]} */
  const zs = [];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (!mat || mat.getName() !== 'facade') continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      if (!arr) continue;
      for (let i = 2; i < arr.length; i += 3) zs.push(Number(arr[i]));
    }
  }
  if (zs.length === 0) {
    return { ok: false, detail: 'no POSITION samples on facade material' };
  }
  const meanZ = zs.reduce((a, b) => a + b, 0) / zs.length;
  if (meanZ <= 0) {
    return {
      ok: false,
      detail: `facade centroid z=${meanZ.toFixed(4)} (expected > 0 for +Z facade)`
    };
  }
  return { ok: true, detail: `facade mean z=${meanZ.toFixed(4)}` };
}

/**
 * @param {string} filePath
 * @param {Map<string, CatalogModule>} catalog
 * @returns {Promise<{ sku: string, ok: boolean, errors: string[], warnings: string[] }>}
 */
async function validateFile(filePath, catalog) {
  const sku = path.basename(filePath, '.glb');
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!existsSync(filePath)) {
    return { sku, ok: false, errors: [`file missing: ${filePath}`], warnings };
  }

  const bytes = statSync(filePath).size;
  if (bytes > MAX_BYTES) {
    errors.push(`file size ${bytes} B > ${MAX_BYTES} B (2 MiB)`);
  }

  const module = catalog.get(sku);
  if (!module) {
    errors.push(`SKU "${sku}" not in kitchen-demo-v1 catalog`);
  }

  const io = new NodeIO();
  /** @type {import('@gltf-transform/core').Document} */
  let document;
  try {
    document = await io.read(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { sku, ok: false, errors: [`failed to parse glTF: ${msg}`], warnings };
  }

  const root = document.getRoot();
  if (root.listCameras().length > 0) {
    errors.push(`contains ${root.listCameras().length} camera(s) — forbidden`);
  }
  const extUsed = root.listExtensionsUsed().map((e) => e.extensionName);
  if (extUsed.some((n) => /light/i.test(n))) {
    errors.push(`light extension present: ${extUsed.join(', ')}`);
  }

  const names = materialNames(document);
  for (const slot of REQUIRED_SLOTS) {
    if (!names.has(slot)) {
      errors.push(`missing material slot "${slot}" (found: ${[...names].join(', ') || 'none'})`);
    }
  }

  for (const mat of root.listMaterials()) {
    const name = mat.getName();
    if (!REQUIRED_SLOTS.includes(/** @type {'facade'|'carcass'} */ (name))) continue;
    const metalness = mat.getMetallicFactor();
    const roughness = mat.getRoughnessFactor();
    if (metalness > METALNESS_MAX) {
      warnings.push(`${name}: metalness=${metalness} (expected ≈ 0)`);
    }
    if (roughness < ROUGHNESS_MIN || roughness > ROUGHNESS_MAX) {
      warnings.push(
        `${name}: roughness=${roughness} (expected ≈ 0.6–0.8)`
      );
    }
  }

  const tris = countTriangles(document);
  if (tris > MAX_TRIANGLES) {
    errors.push(`triangles ${tris} > ${MAX_TRIANGLES}`);
  }
  if (tris === 0) {
    errors.push('no triangles found');
  }

  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) {
    errors.push('no scene in document');
  } else if (module) {
    const bounds = getBounds(scene);
    const sizeX = bounds.max[0] - bounds.min[0];
    const sizeY = bounds.max[1] - bounds.min[1];
    const sizeZ = bounds.max[2] - bounds.min[2];
    const centerX = (bounds.min[0] + bounds.max[0]) / 2;
    const centerY = (bounds.min[1] + bounds.max[1]) / 2;
    const centerZ = (bounds.min[2] + bounds.max[2]) / 2;

    const expectW = module.dimensions.widthMm / 1000;
    const expectH = module.dimensions.heightMm / 1000;
    const expectD = module.dimensions.depthMm / 1000;

    if (Math.abs(sizeX - expectW) > BBOX_TOLERANCE_M) {
      errors.push(
        `bbox width ${sizeX.toFixed(4)} m ≠ catalog ${expectW} m (±${BBOX_TOLERANCE_M})`
      );
    }
    if (Math.abs(sizeY - expectH) > BBOX_TOLERANCE_M) {
      errors.push(
        `bbox height ${sizeY.toFixed(4)} m ≠ catalog ${expectH} m (±${BBOX_TOLERANCE_M})`
      );
    }
    if (Math.abs(sizeZ - expectD) > BBOX_TOLERANCE_M) {
      errors.push(
        `bbox depth ${sizeZ.toFixed(4)} m ≠ catalog ${expectD} m (±${BBOX_TOLERANCE_M})`
      );
    }

    if (Math.abs(centerX) > ORIGIN_TOLERANCE_M
      || Math.abs(centerY) > ORIGIN_TOLERANCE_M
      || Math.abs(centerZ) > ORIGIN_TOLERANCE_M) {
      errors.push(
        `origin not at bbox centre: center=(${centerX.toFixed(4)}, ${centerY.toFixed(4)}, ${centerZ.toFixed(4)})`
      );
    }

    const facadeCheck = checkFacadeFacesPlusZ(document);
    if (!facadeCheck.ok) {
      errors.push(`+Z facade: ${facadeCheck.detail}`);
    }
  }

  // Immutability reminder when validating in-place under snapshot path
  const pngPath = filePath.replace(/\.glb$/i, '.png');
  if (!existsSync(pngPath)) {
    warnings.push(`no thumbnail yet: ${path.basename(pngPath)} (phase 5)`);
  }

  return { sku, ok: errors.length === 0, errors, warnings };
}

async function main() {
  const arg = process.argv[2];
  const catalog = loadCatalogBySku();
  const targets = resolveTargets(arg);

  if (targets.length === 0) {
    console.error(`No .glb files found under ${gltfDir}`);
    console.error('Place author files as apps/server/gltf/{sku}.glb then re-run.');
    process.exit(1);
  }

  let failed = 0;
  for (const filePath of targets) {
    const result = await validateFile(filePath, catalog);
    const tag = result.ok ? 'OK' : 'FAIL';
    console.log(`[${tag}] ${result.sku}  (${path.relative(serverRoot, filePath)})`);
    for (const err of result.errors) console.log(`  error: ${err}`);
    for (const warn of result.warnings) console.log(`  warn:  ${warn}`);
    if (!result.ok) failed += 1;
  }

  console.log(
    failed === 0
      ? `\n${targets.length} file(s) passed.`
      : `\n${failed}/${targets.length} file(s) failed.`
  );
  process.exit(failed === 0 ? 0 : 1);
}

// Exported for tests when imported; CLI when run directly.
export {
  BBOX_TOLERANCE_M,
  MAX_BYTES,
  MAX_TRIANGLES,
  ORIGIN_TOLERANCE_M,
  REQUIRED_SLOTS,
  loadCatalogBySku,
  validateFile
};

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
