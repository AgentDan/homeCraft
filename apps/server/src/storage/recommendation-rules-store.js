/**
 * Persist recommendation rules (Ф4) — local JSON with in-memory engine sync.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RecommendationRuleTableSchema } from '@homecraft/contracts';
import {
  MANDATORY_RECOMMENDATION_RULES,
  replaceRecommendationRules
} from '../core/recommendation-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(__dirname, '../../data');

function storageDir() {
  return process.env.SERVER_STORAGE_DIR
    ? path.resolve(process.env.SERVER_STORAGE_DIR)
    : defaultDir;
}

function rulesPath() {
  return path.join(storageDir(), 'recommendation-rules.json');
}

/**
 * @returns {Promise<import('zod').infer<typeof RecommendationRuleTableSchema>>}
 */
export async function loadRecommendationRulesFromStore() {
  try {
    const raw = await readFile(rulesPath(), 'utf8');
    return RecommendationRuleTableSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [...MANDATORY_RECOMMENDATION_RULES];
    }
    throw error;
  }
}

/**
 * @param {import('zod').infer<typeof RecommendationRuleTableSchema>} rules
 */
export async function saveRecommendationRulesToStore(rules) {
  const parsed = RecommendationRuleTableSchema.parse(rules);
  await mkdir(storageDir(), { recursive: true });
  await writeFile(rulesPath(), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  replaceRecommendationRules(parsed);
  return parsed;
}

/**
 * Boot: load from disk or seed mandatory rules.
 */
export async function ensureRecommendationRulesLoaded() {
  const rules = await loadRecommendationRulesFromStore();
  replaceRecommendationRules(rules);
  // Persist seed if file missing
  try {
    await readFile(rulesPath(), 'utf8');
  } catch {
    await saveRecommendationRulesToStore(rules);
  }
  return rules;
}
