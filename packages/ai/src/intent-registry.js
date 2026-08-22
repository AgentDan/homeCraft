/**
 * @param {string} rawText
 * @param {string} [preferred]
 * @returns {'en' | 'ru' | 'sr'}
 */
function resolveLanguage(rawText, preferred) {
  if (preferred === 'en' || preferred === 'ru' || preferred === 'sr') return preferred;
  // Serbian-specific Cyrillic letters → sr; other Cyrillic → ru; else en
  if (/[ђјљњћ]/i.test(rawText)) return 'sr';
  if (/[а-яё]/i.test(rawText)) return 'ru';
  return 'en';
}

function parseMetricPair(rawText) {
  const match = rawText.match(
    /(\d+(?:[.,]\d+)?)\s*(?:x|×|by|на|х|puta|пута)\s*(\d+(?:[.,]\d+)?)/i
  );
  if (!match) return {};
  const toMillimeters = (value) => {
    const numeric = Number(value.replace(',', '.'));
    return numeric <= 20 ? numeric * 1000 : numeric;
  };
  return {
    roomWidthMm: toMillimeters(match[1]),
    roomDepthMm: toMillimeters(match[2])
  };
}

/**
 * @typedef {object} IntentSlots
 * @property {number} [widthMm]
 * @property {number} [budgetEur]
 * @property {string} [sku]
 * @property {string} [instanceId]
 * @property {string} [finishId]
 * @property {string} [category]
 * @property {string} [layout]
 * @property {string} [branchName]
 * @property {number} [roomWidthMm]
 * @property {number} [roomDepthMm]
 */

/**
 * @param {string} rawText
 * @param {string} kind
 * @returns {string | undefined}
 */
function extractBranchName(rawText, kind) {
  if (kind === 'create_branch') {
    const match = rawText.match(
      /(?:create|new)\s+branch\s+([a-z0-9._-]+)|(?:создай|создать|новая)\s+ветк\w*\s+([a-z0-9._-]+)|(?:kreiraj|napravi|nova)\s+gran\w*\s+([a-z0-9._-]+)/i
    );
    return match?.[1] ?? match?.[2] ?? match?.[3];
  }
  if (kind === 'switch_branch') {
    const match = rawText.match(
      /switch\s+(?:to\s+)?(?:branch\s+)?([a-z0-9._-]+)|(?:переключ|смен)\w*\s+(?:на\s+)?ветк\w*\s+([a-z0-9._-]+)|(?:prebaci|pređi|predi)\s+(?:na\s+)?gran\w*\s+([a-z0-9._-]+)/i
    );
    return match?.[1] ?? match?.[2] ?? match?.[3];
  }
  return undefined;
}

/**
 * @typedef {object} SlotVocabulary
 * @property {string[]} [skuPrefixes]
 * @property {Array<{ category: string, patterns: RegExp[] }>} [categoryKeywords]
 * @property {Array<{ finishId: string, patterns: RegExp[] }>} [finishKeywords]
 * @property {Array<{ layout: string, patterns: RegExp[] }>} [layoutKeywords]
 */

/**
 * @param {string} rawText
 * @param {string} kind
 * @param {SlotVocabulary} [vocabulary]
 * @returns {IntentSlots}
 */
function extractSlots(rawText, kind, vocabulary = {}) {
  /** @type {IntentSlots} */
  const slots = {};
  const widthMatch = rawText.match(
    /(?:width\s*|ширин[аыу]?\s*|širin[aeu]?\s*|sirin[aeu]?\s*)?(\d{3,4})\s*(?:mm|мм)?/i
  );
  const budgetMatch = rawText.match(
    /(?:budget|up\s+to|бюджет|буџет|budžet|budzet|до|do)\s*(?:of\s*|до\s*|do\s*)?[$£€]?([\d\s,]{3,})/i
  );
  const prefixes = vocabulary.skuPrefixes;
  const skuMatch =
    Array.isArray(prefixes) && prefixes.length > 0
      ? rawText.match(new RegExp(`\\b(?:${prefixes.join('|')})-\\d+\\b`, 'i'))
      : null;
  const instanceMatch = rawText.match(/\bmodule-\d+\b/i);
  const branchName = extractBranchName(rawText, kind);

  if (widthMatch) slots.widthMm = Number(widthMatch[1]);
  if (budgetMatch) slots.budgetEur = Number(budgetMatch[1].replace(/[\s,]/g, ''));
  if (skuMatch) slots.sku = skuMatch[0].toUpperCase();
  if (instanceMatch) slots.instanceId = instanceMatch[0].toLowerCase();
  if (branchName) slots.branchName = branchName.toLowerCase();

  // Last matching entry wins — same overwrite order as the previous sequential if-blocks.
  for (const entry of vocabulary.finishKeywords ?? []) {
    if (entry.patterns.some((pattern) => pattern.test(rawText))) {
      slots.finishId = entry.finishId;
    }
  }
  for (const entry of vocabulary.categoryKeywords ?? []) {
    if (entry.patterns.some((pattern) => pattern.test(rawText))) {
      slots.category = entry.category;
    }
  }

  if (kind === 'add_module') {
    for (const entry of vocabulary.layoutKeywords ?? []) {
      if (entry.patterns.some((pattern) => pattern.test(rawText))) {
        slots.layout = entry.layout;
        const room = parseMetricPair(rawText);
        if (room.roomWidthMm != null) slots.roomWidthMm = room.roomWidthMm;
        if (room.roomDepthMm != null) slots.roomDepthMm = room.roomDepthMm;
      }
    }
  }
  return slots;
}

/**
 * @typedef {{ kind: string, matchers: Array<{ language: string, patterns: RegExp[] }> }} IntentRule
 */

/**
 * @param {unknown} rules
 * @returns {asserts rules is IntentRule[]}
 */
function assertIntentRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('matchIntent: rules is required');
  }
}

/**
 * @param {string} text
 * @param {IntentRule[]} rules
 * @param {{ language?: 'en' | 'ru' | 'sr', vocabulary?: SlotVocabulary }} [options]
 * @returns {import('zod').infer<typeof import('@homecraft/contracts').IntentResultSchema>}
 */
export function matchIntent(text, rules, options = {}) {
  assertIntentRules(rules);

  const rawText = text.trim();
  const language = resolveLanguage(rawText, options.language);

  if (!rawText) {
    return { kind: 'unknown', language, rawText, reason: 'empty_input' };
  }

  for (const rule of rules) {
    for (const matcher of rule.matchers) {
      const matched = matcher.patterns.every((pattern) => pattern.test(rawText));
      if (matched) {
        return {
          kind: /** @type {Exclude<import('zod').infer<typeof import('@homecraft/contracts').IntentKindSchema>, 'unknown'>} */ (
            rule.kind
          ),
          confidence: 0.75,
          language,
          rawText,
          /** @type {IntentSlots} */
          slots: extractSlots(rawText, rule.kind, options.vocabulary)
        };
      }
    }
  }

  return { kind: 'unknown', language, rawText, reason: 'no_pattern_match' };
}
