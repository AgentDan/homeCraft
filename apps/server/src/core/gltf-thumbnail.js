import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLTF_DIR = path.resolve(__dirname, '../../gltf');

/**
 * Public URL for a Homecraft glTF thumbnail when the PNG exists on disk.
 * @param {string | undefined | null} sku
 * @returns {string | undefined}
 */
export function resolveSkuThumbnailUrl(sku) {
  if (!sku || typeof sku !== 'string') return undefined;
  const filePath = path.join(GLTF_DIR, `${sku}.png`);
  if (!existsSync(filePath)) return undefined;
  return `/gltf/${encodeURIComponent(sku)}.png`;
}
