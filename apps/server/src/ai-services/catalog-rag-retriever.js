import { RetrievedModuleSchema } from '@homecraft/contracts';
import {
  loadCatalogIndex,
  tokenize,
  vectorize
} from '../knowledge-base/indexer.js';

const STOP_WORDS = new Set([
  'добавь',
  'добавить',
  'поставь',
  'пожалуйста',
  'мне',
  'для',
  'кухни',
  'module',
  'add'
]);

function tokenMatches(queryToken, indexedToken) {
  if (queryToken === indexedToken) return true;
  if (queryToken.length < 4 || indexedToken.length < 4) return false;
  return queryToken.startsWith(indexedToken.slice(0, 4))
    || indexedToken.startsWith(queryToken.slice(0, 4));
}

function scoreTokens(queryTokens, indexedTokens) {
  if (queryTokens.length === 0) return 0;
  const matches = queryTokens.filter((queryToken) =>
    indexedTokens.some((indexedToken) => tokenMatches(queryToken, indexedToken))
  ).length;
  return matches / queryTokens.length;
}

function cosineSimilarity(left, right) {
  return left.reduce(
    (sum, value, index) => sum + value * (right[index] ?? 0),
    0
  );
}

export async function retrieve(query, catalogId, k = 5) {
  const index = await loadCatalogIndex();
  if (index.catalogVersion !== catalogId) {
    throw new Error(`Catalog index "${catalogId}" was not found.`);
  }

  const queryTokens = tokenize(query).filter((token) => !STOP_WORDS.has(token));
  const queryVector = vectorize(queryTokens);
  const ranked = index.modules
    .map((entry) => ({
      ...entry.module,
      score:
        scoreTokens(queryTokens, entry.tokens) * 0.7
        + cosineSimilarity(queryVector, entry.vector) * 0.3,
      source: `catalog:${index.catalogVersion}`
    }))
    .filter((module) => module.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || left.dimensions.widthMm - right.dimensions.widthMm
      || left.sku.localeCompare(right.sku)
    )
    .slice(0, k);

  if (
    ranked.length === 0
    && /модул|шкаф|module|cabinet/i.test(query)
  ) {
    const fallback = index.modules.find((entry) => entry.module.sku === 'BASE-600');
    if (fallback) {
      ranked.push({
        ...fallback.module,
        score: 0.1,
        source: `catalog:${index.catalogVersion}`
      });
    }
  }

  return ranked.map((module) => RetrievedModuleSchema.parse(module));
}

export async function retrievePlatformRules(query, k = 3) {
  const index = await loadCatalogIndex();
  const queryTokens = tokenize(query);
  const queryVector = vectorize(queryTokens);
  const ranked = index.platformRules
    .map((rule) => ({
      id: rule.id,
      text: rule.text,
      score:
        scoreTokens(queryTokens, rule.tokens) * 0.7
        + cosineSimilarity(queryVector, rule.vector) * 0.3,
      source: 'platform-rules'
    }))
    .sort((left, right) => right.score - left.score);
  const matched = ranked.filter((rule) => rule.score > 0).slice(0, k);
  return matched.length > 0 ? matched : ranked.slice(0, 1);
}
