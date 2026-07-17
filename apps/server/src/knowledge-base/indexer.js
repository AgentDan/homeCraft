import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDemoCatalog } from './catalog-store.js';
import { getMongoDb } from '../storage/mongo.js';

const indexPath = fileURLToPath(
  new URL('./data/index/catalog-index.json', import.meta.url)
);
const platformRulesPath = fileURLToPath(
  new URL('./data/source/platform-rules.md', import.meta.url)
);

export function tokenize(value) {
  return String(value)
    .toLocaleLowerCase('en-US')
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((token) => token.length > 1);
}

function tokenHash(token) {
  let hash = 2166136261;
  for (const character of token) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function vectorize(tokens, dimensions = 128) {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokens) {
    vector[tokenHash(token) % dimensions] += 1;
  }
  const magnitude = Math.hypot(...vector);
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

function moduleSearchText(module) {
  return [
    module.sku,
    module.name,
    module.category.replaceAll('_', ' '),
    module.mounting,
    module.dimensions.widthMm,
    module.dimensions.heightMm,
    module.dimensions.depthMm,
    ...module.utilities,
    ...module.finishes.flatMap((finish) => [finish.id, finish.name])
  ].join(' ');
}

function splitMarkdown(markdown) {
  return markdown
    .split(/(?=^#{1,3}\s)/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `platform-rule-${index + 1}`,
      text,
      tokens: tokenize(text),
      vector: vectorize(tokenize(text))
    }));
}

export async function buildCatalogIndex() {
  const [catalog, platformRules] = await Promise.all([
    loadDemoCatalog(),
    readFile(platformRulesPath, 'utf8')
  ]);

  return {
    indexVersion: 2,
    catalogVersion: catalog.catalogVersion,
    generatedAt: new Date().toISOString(),
    modules: catalog.modules.map((module) => {
      const searchText = moduleSearchText(module);
      return {
        module,
        searchText,
        tokens: tokenize(searchText),
        vector: vectorize(tokenize(searchText))
      };
    }),
    platformRules: splitMarkdown(platformRules)
  };
}

async function seedMongo(catalog) {
  const db = await getMongoDb();
  if (!db) {
    return false;
  }

  await db.collection('catalogSnapshots').replaceOne(
    { catalogVersion: catalog.catalogVersion },
    catalog,
    { upsert: true }
  );
  return true;
}

export async function runCatalogIndexer() {
  const [catalog, index] = await Promise.all([
    loadDemoCatalog(),
    buildCatalogIndex()
  ]);

  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const mongoSeeded = await seedMongo(catalog);

  const summary = {
    catalogVersion: catalog.catalogVersion,
    moduleCount: index.modules.length,
    platformRuleCount: index.platformRules.length,
    mongoSeeded,
    indexPath
  };
  console.log('[catalog:index]', summary);
  return summary;
}

export async function loadCatalogIndex() {
  try {
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    return index.indexVersion === 2 ? index : buildCatalogIndex();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return buildCatalogIndex();
    }
    throw error;
  }
}
