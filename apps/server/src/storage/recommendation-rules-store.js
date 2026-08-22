/**
 * Persist recommendation rules (Ф4) — local JSON with in-memory engine sync.
 * One file per productType so kitchen and desk keep independently editable tables.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RecommendationRuleTableSchema, registry } from '@homecraft/contracts';
import { replaceRecommendationRules } from '../core/recommendation-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(__dirname, '../../data');

function storageDir() {
  return process.env.SERVER_STORAGE_DIR
    ? path.resolve(process.env.SERVER_STORAGE_DIR)
    : defaultDir;
}

/**
 * Flat `recommendation-rules-${productType}.json` next to other store files.
 * A per-domain subdirectory would need an extra mkdir and a path helper;
 * the suffix reuses storageDir() with no extra layout.
 * @param {string} productType
 */
function rulesPath(productType) {
  return path.join(storageDir(), `recommendation-rules-${productType}.json`);
}

/**
 * @param {string} productType
 */
function seedRulesFor(productType) {
  return [...(registry.get(productType).dp4Rules ?? [])];
}

/**
 * @param {string} productType
 * @returns {Promise<import('zod').infer<typeof RecommendationRuleTableSchema>>}
 */
export async function loadRecommendationRulesFromStore(productType) {
  try {
    const raw = await readFile(rulesPath(productType), 'utf8');
    return RecommendationRuleTableSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return seedRulesFor(productType);
    }
    throw error;
  }
}

/**
 * @param {import('zod').infer<typeof RecommendationRuleTableSchema>} rules
 * @param {string} productType
 */
export async function saveRecommendationRulesToStore(rules, productType) {
  const parsed = RecommendationRuleTableSchema.parse(rules);
  await mkdir(storageDir(), { recursive: true });
  await writeFile(rulesPath(productType), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  replaceRecommendationRules(productType, parsed);
  return parsed;
}

/**
 * Boot: load from disk or seed the domain's manifest dp4Rules.
 * @param {string} productType
 */
export async function ensureRecommendationRulesLoaded(productType) {
  const rules = await loadRecommendationRulesFromStore(productType);
  replaceRecommendationRules(productType, rules);
  try {
    await readFile(rulesPath(productType), 'utf8');
  } catch {
    await saveRecommendationRulesToStore(rules, productType);
  }
  return rules;
}
