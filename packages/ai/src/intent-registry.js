const RULES = [
  {
    kind: 'create_branch',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:create|new)\s+branch\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:создай|создать|новая)\s+ветк/i]
      },
      {
        language: 'sr',
        patterns: [/(?:kreiraj|napravi|nova)\s+gran/i]
      }
    ]
  },
  {
    kind: 'switch_branch',
    matchers: [
      {
        language: 'en',
        patterns: [/\bswitch\s+(?:to|branch)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:переключ|смен)\w*\s+(?:на\s+)?ветк/i]
      },
      {
        language: 'sr',
        patterns: [/(?:prebaci|pređi|predi)\s+(?:na\s+)?gran/i]
      }
    ]
  },
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
      },
      {
        language: 'sr',
        patterns: [
          /(?:zamen|zamijen|замен)/i,
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
      },
      {
        language: 'sr',
        patterns: [
          /(?:dodaj|stavi|ugradi|napravi|kreiraj|kuhinj|додај|стави|угради|кухињ)/i,
          /(?:ormar|modul|ormarić|sudoper|kuhinj|ормар|модул|судопер|кухињ)/i
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
      },
      {
        language: 'sr',
        patterns: [/(?:ukloni|obriši|obrisi|skini|уклони|обриши|скини)/i]
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
      },
      {
        language: 'sr',
        patterns: [
          /(?:fasad|završn|zavrsn|materijal|boj[ae]|hrast|bel[ae]|bijel|фасад|храст|бел)/i
        ]
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
      },
      {
        language: 'sr',
        patterns: [/(?:budžet|budzet|буџет|do\s+\d)/i]
      }
    ]
  },
  {
    kind: 'export_project',
    matchers: [
      {
        language: 'en',
        patterns: [/\b(?:export|download)\b/i, /\b(?:pdf|spec|specification|bom)\b/i]
      },
      {
        language: 'en',
        patterns: [/\bexport\s+(?:project|plan|kitchen)\b/i]
      },
      {
        language: 'ru',
        patterns: [/(?:экспорт|выгруз|скач)/i, /(?:pdf|спецификац|смет)/i]
      },
      {
        language: 'ru',
        patterns: [/(?:экспорт(?:ируй)?\s+проект)/i]
      },
      {
        language: 'sr',
        patterns: [/(?:izvoz|preuzmi|export)/i, /(?:pdf|specifikac|predračun|predracun)/i]
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
      },
      {
        language: 'sr',
        patterns: [
          /(?:cen[ae]|cijen|koliko\s+košt|koliko\s+kost|ukupn|procen|цен[ае]|колико\s+кошт)/i
        ]
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
      },
      {
        language: 'sr',
        patterns: [/(?:poništi|ponisti|nazad|vrati|поништи|назад|врати)/i]
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
      },
      {
        language: 'sr',
        patterns: [/^(?:ponovi|понови)/i]
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
        language: 'en',
        patterns: [/\b(?:show\s+)?(?:the\s+)?catalog\b|\bkatalog\b/i]
      },
      {
        language: 'en',
        patterns: [
          /\b(?:list|show)\s+commands?\b|\bavailable\s+commands?\b|\bwhat\s+commands\b/i
        ]
      },
      {
        language: 'ru',
        patterns: [/(?:помощ|справк|что\s+ты\s+умеешь)/i]
      },
      {
        language: 'ru',
        patterns: [/(?:каталог|список\s+модул)/i]
      },
      {
        language: 'ru',
        patterns: [/(?:какие\s+команды|список\s+команд|доступные\s+команды)/i]
      },
      {
        language: 'sr',
        patterns: [/(?:pomoć|pomoc|šta\s+možeš|sta\s+mozes|помоћ|шта\s+можеш)/i]
      },
      {
        language: 'sr',
        patterns: [/(?:katalog|lista\s+modul)/i]
      },
      {
        language: 'sr',
        patterns: [/(?:komande|lista\s+komand|dostupne\s+komande)/i]
      }
    ]
  }
];

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
 * @param {string} rawText
 * @param {string} kind
 * @returns {IntentSlots}
 */
function extractSlots(rawText, kind) {
  /** @type {IntentSlots} */
  const slots = {};
  const widthMatch = rawText.match(
    /(?:width\s*|ширин[аыу]?\s*|širin[aeu]?\s*|sirin[aeu]?\s*)?(\d{3,4})\s*(?:mm|мм)?/i
  );
  const budgetMatch = rawText.match(
    /(?:budget|up\s+to|бюджет|буџет|budžet|budzet|до|do)\s*(?:of\s*|до\s*|do\s*)?[$£€]?([\d\s,]{3,})/i
  );
  const skuMatch = rawText.match(
    /\b(?:BASE|WALL|SINK|HOB|OVEN|CORNER|TALL|FRIDGE|DISHWASHER)-\d+\b/i
  );
  const instanceMatch = rawText.match(/\bmodule-\d+\b/i);
  const branchName = extractBranchName(rawText, kind);

  if (widthMatch) slots.widthMm = Number(widthMatch[1]);
  if (budgetMatch) slots.budgetEur = Number(budgetMatch[1].replace(/[\s,]/g, ''));
  if (skuMatch) slots.sku = skuMatch[0].toUpperCase();
  if (instanceMatch) slots.instanceId = instanceMatch[0].toLowerCase();
  if (branchName) slots.branchName = branchName.toLowerCase();
  if (/\boak\b|дуб|hrast|храст/i.test(rawText)) slots.finishId = 'oak';
  if (/\bwhite\b|бел|bel[ae]|bijel/i.test(rawText)) slots.finishId = 'white';
  if (/\bsink\b|мойк|sudoper|судопер/i.test(rawText)) slots.category = 'sink_cabinet';
  if (
    /\b(?:wall|wall-mounted|hanging)\b|навесн|верхн|zidn[ia]|viseć|viseci|зидн|висећ/i.test(
      rawText
    )
  ) {
    slots.category = 'wall_cabinet';
  }
  if (/\bcorner\b|углов|ugaon|угаон/i.test(rawText)) slots.category = 'corner_cabinet';
  if (/\b(?:pantry|tall)\b|пенал|высок|visok|висок/i.test(rawText)) {
    slots.category = 'tall_cabinet';
  }
  if (/\bdrawer\b|ящик|fiok|фиок/i.test(rawText)) slots.category = 'drawer_cabinet';
  if (/\boven\b|духов|rern|рерн/i.test(rawText)) slots.category = 'oven_cabinet';
  if (/\b(?:hob|cooktop)\b|варочн|ploč|ploc|плоч/i.test(rawText)) {
    slots.category = 'hob_cabinet';
  }

  if (
    kind === 'add_module' &&
    (/\bkitchen\b/i.test(rawText) || /кухн/i.test(rawText) || /kuhinj|кухињ/i.test(rawText))
  ) {
    slots.layout = 'starter_kitchen';
    const room = parseMetricPair(rawText);
    if (room.roomWidthMm != null) slots.roomWidthMm = room.roomWidthMm;
    if (room.roomDepthMm != null) slots.roomDepthMm = room.roomDepthMm;
  }
  return slots;
}

/**
 * @param {string} text
 * @param {{ language?: 'en' | 'ru' | 'sr' }} [options]
 * @returns {import('zod').infer<typeof import('@homecraft/contracts').IntentResultSchema>}
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
          kind: /** @type {Exclude<import('zod').infer<typeof import('@homecraft/contracts').IntentKindSchema>, 'unknown'>} */ (
            rule.kind
          ),
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
