const RULES = [
  {
    kind: 'add_module',
    patterns: [
      /добав(ь|ить)|постав(ь|ить)|установ(и|ить)|кухн|add/i,
      /шкаф|модуль|тумб|мойк|пенал|кухн|module|cabinet/i
    ]
  },
  {
    kind: 'remove_module',
    patterns: [/убер(и|ите)|убра(ть|л)|удал(и|ить)|remove|delete/i]
  },
  {
    kind: 'change_finish',
    patterns: [/фасад|отделк|материал|finish|цвет|color|дуб|oak/i]
  },
  {
    kind: 'set_budget',
    patterns: [/бюджет|budget|до\s+[\d\s]+/i]
  },
  {
    kind: 'show_price',
    patterns: [/сколько.*стоит|цена|price|стоимость|итого/i]
  },
  {
    kind: 'undo',
    patterns: [/отмен(и|ить)|верни\s+как\s+было|назад|undo/i]
  },
  {
    kind: 'redo',
    patterns: [/^(верни|повтори|redo)(\s+последнее)?[.!?]?$/i]
  },
  {
    kind: 'help',
    patterns: [/помощь|help|что ты умеешь|what can you do/i]
  }
];

function detectLanguage(text) {
  return /[а-яё]/i.test(text) ? 'ru' : 'en';
}

function parseMetricPair(rawText) {
  const match = rawText.match(/(\d+(?:[.,]\d+)?)\s*[xх×]\s*(\d+(?:[.,]\d+)?)/i);
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

function extractSlots(rawText, kind) {
  const slots = {};
  const widthMatch = rawText.match(/(?:ширин(?:ой|а)?\s*)?(\d{3,4})\s*(?:мм)?/i);
  const budgetMatch = rawText.match(/(?:бюджет|до)\s*([\d\s]{3,})/i);
  const skuMatch = rawText.match(/\b(?:BASE|WALL|SINK|HOB|OVEN|CORNER|TALL|FRIDGE|DISHWASHER)-\d+\b/i);
  const instanceMatch = rawText.match(/\bmodule-\d+\b/i);

  if (widthMatch) slots.widthMm = Number(widthMatch[1]);
  if (budgetMatch) slots.budgetRub = Number(budgetMatch[1].replace(/\s/g, ''));
  if (skuMatch) slots.sku = skuMatch[0].toUpperCase();
  if (instanceMatch) slots.instanceId = instanceMatch[0].toLowerCase();
  if (/дуб|oak/i.test(rawText)) slots.finishId = 'oak';
  if (/бел(ый|ого|ые)|white/i.test(rawText)) slots.finishId = 'white';
  if (/мойк/i.test(rawText)) slots.category = 'sink_cabinet';
  if (/навес/i.test(rawText)) slots.category = 'wall_cabinet';
  if (/углов/i.test(rawText)) slots.category = 'corner_cabinet';
  if (/пенал/i.test(rawText)) slots.category = 'tall_cabinet';
  if (/ящик/i.test(rawText)) slots.category = 'drawer_cabinet';
  if (/духов/i.test(rawText)) slots.category = 'oven_cabinet';
  if (/вароч/i.test(rawText)) slots.category = 'hob_cabinet';

  if (kind === 'add_module' && /кухн/i.test(rawText)) {
    slots.layout = 'starter_kitchen';
    Object.assign(slots, parseMetricPair(rawText));
  }
  return slots;
}

export function matchIntent(text) {
  const rawText = text.trim();
  const language = detectLanguage(rawText);

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
        slots: extractSlots(rawText, rule.kind)
      };
    }
  }

  return { kind: 'unknown', language, rawText, reason: 'no_pattern_match' };
}

export { RULES as intentRules };
