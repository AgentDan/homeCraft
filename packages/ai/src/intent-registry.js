const RULES = [
  {
    kind: 'add_module',
    patterns: [
      /\b(?:add|place|install|build|create|kitchen)\b/i,
      /\b(?:cabinet|module|cupboard|sink|pantry|kitchen)\b/i
    ]
  },
  {
    kind: 'remove_module',
    patterns: [/\b(?:remove|delete)\b/i]
  },
  {
    kind: 'change_finish',
    patterns: [/\b(?:facade|front|finish|material|color|colour|oak|white)\b/i]
  },
  {
    kind: 'set_budget',
    patterns: [/\b(?:budget|up\s+to)\b/i]
  },
  {
    kind: 'show_price',
    patterns: [/\b(?:price|cost|total|estimate)\b/i]
  },
  {
    kind: 'undo',
    patterns: [/\b(?:undo|revert|go\s+back)\b/i]
  },
  {
    kind: 'redo',
    patterns: [/^(?:redo|repeat)(?:\s+(?:the\s+)?last(?:\s+(?:change|action))?)?[.!?]?$/i]
  },
  {
    kind: 'help',
    patterns: [/\bhelp\b|what can you do/i]
  }
];

function parseMetricPair(rawText) {
  const match = rawText.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|by)\s*(\d+(?:[.,]\d+)?)/i);
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
 * @property {number} [roomWidthMm]
 * @property {number} [roomDepthMm]
 */

/**
 * @param {string} rawText
 * @param {string} kind
 * @returns {IntentSlots}
 */
function extractSlots(rawText, kind) {
  /** @type {IntentSlots} */
  const slots = {};
  const widthMatch = rawText.match(/(?:width\s*)?(\d{3,4})\s*(?:mm)?/i);
  const budgetMatch = rawText.match(/(?:budget|up\s+to)\s*(?:of\s*)?[$£€]?([\d\s,]{3,})/i);
  const skuMatch = rawText.match(/\b(?:BASE|WALL|SINK|HOB|OVEN|CORNER|TALL|FRIDGE|DISHWASHER)-\d+\b/i);
  const instanceMatch = rawText.match(/\bmodule-\d+\b/i);

  if (widthMatch) slots.widthMm = Number(widthMatch[1]);
  if (budgetMatch) slots.budgetEur = Number(budgetMatch[1].replace(/[\s,]/g, ''));
  if (skuMatch) slots.sku = skuMatch[0].toUpperCase();
  if (instanceMatch) slots.instanceId = instanceMatch[0].toLowerCase();
  if (/\boak\b/i.test(rawText)) slots.finishId = 'oak';
  if (/\bwhite\b/i.test(rawText)) slots.finishId = 'white';
  if (/\bsink\b/i.test(rawText)) slots.category = 'sink_cabinet';
  if (/\b(?:wall|wall-mounted|hanging)\b/i.test(rawText)) slots.category = 'wall_cabinet';
  if (/\bcorner\b/i.test(rawText)) slots.category = 'corner_cabinet';
  if (/\b(?:pantry|tall)\b/i.test(rawText)) slots.category = 'tall_cabinet';
  if (/\bdrawer\b/i.test(rawText)) slots.category = 'drawer_cabinet';
  if (/\boven\b/i.test(rawText)) slots.category = 'oven_cabinet';
  if (/\b(?:hob|cooktop)\b/i.test(rawText)) slots.category = 'hob_cabinet';

  if (kind === 'add_module' && /\bkitchen\b/i.test(rawText)) {
    slots.layout = 'starter_kitchen';
    const room = parseMetricPair(rawText);
    if (room.roomWidthMm != null) slots.roomWidthMm = room.roomWidthMm;
    if (room.roomDepthMm != null) slots.roomDepthMm = room.roomDepthMm;
  }
  return slots;
}

export function matchIntent(text) {
  const rawText = text.trim();
  const language = 'en';

  if (!rawText) {
    return { kind: 'unknown', language, rawText, reason: 'empty_input' };
  }

  for (const rule of RULES) {
    const matched = rule.patterns.every((pattern) => pattern.test(rawText));
    if (matched) {
      return {
        kind: rule.kind,
        confidence: 0.75,
        language,
        rawText,
        /** @type {IntentSlots} */
        slots: extractSlots(rawText, rule.kind)
      };
    }
  }

  return { kind: 'unknown', language, rawText, reason: 'no_pattern_match' };
}

export { RULES as intentRules };
