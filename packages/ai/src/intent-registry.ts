import type { IntentKind, IntentResult } from '@homecraft/contracts';

type KnownIntentKind = Exclude<IntentKind, 'unknown'>;

type PatternRule = {
  kind: KnownIntentKind;
  patterns: RegExp[];
};

const RULES: PatternRule[] = [
  {
    kind: 'add_module',
    patterns: [/добав(ь|ить)|add/i, /шкаф|модуль|module|cabinet/i]
  },
  {
    kind: 'remove_module',
    patterns: [/убер(и|ите)|remove|delete/i]
  },
  {
    kind: 'change_finish',
    patterns: [/фасад|finish|цвет|color|дуб|oak/i]
  },
  {
    kind: 'set_budget',
    patterns: [/бюджет|budget|до\s+\d+/i]
  },
  {
    kind: 'show_price',
    patterns: [/сколько стоит|цена|price|стоимость/i]
  },
  {
    kind: 'help',
    patterns: [/помощь|help|что ты умеешь|what can you do/i]
  }
];

function detectLanguage(text: string): 'ru' | 'en' {
  return /[а-яё]/i.test(text) ? 'ru' : 'en';
}

/**
 * Rule-based intent registry. No silent fallback — unknown returns UnknownIntent.
 */
export function matchIntent(text: string): IntentResult {
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
        slots: {}
      };
    }
  }

  return { kind: 'unknown', language, rawText, reason: 'no_pattern_match' };
}

export { RULES as intentRules };
