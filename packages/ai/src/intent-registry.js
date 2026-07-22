const RULES = [
  {
    kind: 'replace_module',
    matchers: [
      {
        language: 'en',
        patterns: [
          /\b(?:replace|swap)\b/i,
          /\b(?:BASE|WALL|SINK|HOB|OVEN|CORNER|TALL|FRIDGE|DISHWASHER)-\d+\b/i
        ]
      },
      {
        language: 'ru',
        patterns: [
          /(?:замен|помен|свап)/i,
          /(?:BASE|WALL|SINK|HOB|OVEN|CORNER|TALL|FRIDGE|DISHWASHER)-\d+/i
        ]
      }
    ]
  },
  {
    kind: 'add_module',
    matchers: [
      {
        language: 'en',
        patterns: [
          /\b(?:add|place|install|build|create|kitchen)\b/i,
          /\b(?:cabinet|module|cupboard|sink|pantry|kitchen)\b/i
        ]
      },
      {
        language: 'ru',
        patterns: [
          /(?:добав|постав|установи|собери|создай|кухн)/i,
          /(?:шкаф|модул|тумб|мойк|пенал|кухн)/i
        ]
      }
    ]
  },
  {
    kind: 'remove_module',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:remove|delete)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:удал|убер|сними)/i]
      }
    ]
  },
  {
    kind: 'change_finish',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:facade|front|finish|material|color|colour|oak|white)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:фасад|отделк|материал|цвет|дуб|бел)/i]
      }
    ]
  },
  {
    kind: 'set_budget',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:budget|up\s+to)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:бюджет|до\s+\d)/i]
      }
    ]
  },
  {
    kind: 'show_price',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:price|cost|total|estimate)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:цен|стоимость|сколько\s+стоит|итог|смет)/i]
      }
    ]
  },
  {
    kind: 'undo',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:undo|revert|go\s+back)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:отмен|назад|верни)/i]
      }
    ]
  },
  {
    kind: 'redo',
    matchers: [
      {
        language: 'en',
        patterns: [/^(?:redo|repeat)(?:\s+(?:the\s+)?last(?:\s+(?:change|action))?)?[.!?]?$/i]
      },
      {
        language: 'ru',
        patterns: [/^(?:повтор|вернуть\s+отменённ)/i]
      }
    ]
  },
  {
    kind: 'help',
    matchers: [
      {
        language: 'en',
        patterns: [/\bhelp\b|what can you do/i]
      },
      {
        language: 'ru',
        patterns: [/(?:помощ|справк|что\s+ты\s+умеешь)/i]
      }
    ]
  }
];

/**
 * @param {string} rawText
 * @param {string} [preferred]
 * @returns {'en' | 'ru'}
 */
function resolveLanguage(rawText, preferred) {
  if (preferred === 'en' || preferred === 'ru') return preferred;
  return /[а-яё]/i.test(rawText) ? 'ru' : 'en';
}

function parseMetricPair(rawText) {
  const match = rawText.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|by|на|х)\s*(\d+(?:[.,]\d+)?)/i);
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
  const widthMatch = rawText.match(/(?:width\s*|ширин[аыу]?\s*)?(\d{3,4})\s*(?:mm|мм)?/i);
  const budgetMatch = rawText.match(
    /(?:budget|up\s+to|бюджет|до)\s*(?:of\s*|до\s*)?[$£€]?([\d\s,]{3,})/i
  );
  const skuMatch = rawText.match(
    /\b(?:BASE|WALL|SINK|HOB|OVEN|CORNER|TALL|FRIDGE|DISHWASHER)-\d+\b/i
  );
  const instanceMatch = rawText.match(/\bmodule-\d+\b/i);

  if (widthMatch) slots.widthMm = Number(widthMatch[1]);
  if (budgetMatch) slots.budgetEur = Number(budgetMatch[1].replace(/[\s,]/g, ''));
  if (skuMatch) slots.sku = skuMatch[0].toUpperCase();
  if (instanceMatch) slots.instanceId = instanceMatch[0].toLowerCase();
  if (/\boak\b|дуб/i.test(rawText)) slots.finishId = 'oak';
  if (/\bwhite\b|бел/i.test(rawText)) slots.finishId = 'white';
  if (/\bsink\b|мойк/i.test(rawText)) slots.category = 'sink_cabinet';
  if (/\b(?:wall|wall-mounted|hanging)\b|навесн|верхн/i.test(rawText)) {
    slots.category = 'wall_cabinet';
  }
  if (/\bcorner\b|углов/i.test(rawText)) slots.category = 'corner_cabinet';
  if (/\b(?:pantry|tall)\b|пенал|высок/i.test(rawText)) slots.category = 'tall_cabinet';
  if (/\bdrawer\b|ящик/i.test(rawText)) slots.category = 'drawer_cabinet';
  if (/\boven\b|духов/i.test(rawText)) slots.category = 'oven_cabinet';
  if (/\b(?:hob|cooktop)\b|варочн/i.test(rawText)) slots.category = 'hob_cabinet';

  if (kind === 'add_module' && (/\bkitchen\b/i.test(rawText) || /кухн/i.test(rawText))) {
    slots.layout = 'starter_kitchen';
    const room = parseMetricPair(rawText);
    if (room.roomWidthMm != null) slots.roomWidthMm = room.roomWidthMm;
    if (room.roomDepthMm != null) slots.roomDepthMm = room.roomDepthMm;
  }
  return slots;
}

/**
 * @param {string} text
 * @param {{ language?: 'en' | 'ru' }} [options]
 */
export function matchIntent(text, options = {}) {
  const rawText = text.trim();
  const language = resolveLanguage(rawText, options.language);

  if (!rawText) {
    return { kind: 'unknown', language, rawText, reason: 'empty_input' };
  }

  for (const rule of RULES) {
    for (const matcher of rule.matchers) {
      const matched = matcher.patterns.every((pattern) => pattern.test(rawText));
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
  }

  return { kind: 'unknown', language, rawText, reason: 'no_pattern_match' };
}
