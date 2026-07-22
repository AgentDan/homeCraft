/** @typedef {'en' | 'ru'} Locale */

export const LOCALES = /** @type {const} */ (['en', 'ru']);

export const SPEECH_LANG = {
  en: 'en-US',
  ru: 'ru-RU'
};

const STRINGS = {
  en: {
    command: 'Command',
    spaceHint: 'Space',
    commandPlaceholder: 'add a 600 mm cabinet',
    send: 'Send',
    chat: 'Chat',
    chatEmpty: 'Describe what you want — for example, “add a 600 mm cabinet”.',
    thinking: 'Thinking…',
    done: 'Done.',
    billOfMaterials: 'Bill of materials',
    noPricedModules: 'No priced modules yet.',
    item: 'Item',
    qty: 'Qty',
    total: 'Total',
    subtotal: 'Subtotal',
    vatIncl: 'VAT (incl.)',
    budget: 'Budget',
    budgetNotSet: 'Not set — try “budget up to 150000”.',
    budgetUsed: 'Budget used',
    overBy: 'Over by {amount}',
    remaining: '{amount} remaining',
    reply: 'Reply',
    yes: 'Yes',
    no: 'No',
    voiceTitle: 'Voice command',
    voicePrompt: 'Voice transcript (demo):',
    voiceSample: 'add module',
    language: 'Language'
  },
  ru: {
    command: 'Команда',
    spaceHint: 'Пробел',
    commandPlaceholder: 'добавь шкаф 600 мм',
    send: 'Отправить',
    chat: 'Чат',
    chatEmpty: 'Опишите, что нужно — например, «добавь шкаф 600 мм».',
    thinking: 'Думаю…',
    done: 'Готово.',
    billOfMaterials: 'Спецификация',
    noPricedModules: 'Пока нет модулей с ценой.',
    item: 'Позиция',
    qty: 'Кол-во',
    total: 'Итого',
    subtotal: 'Подытог',
    vatIncl: 'НДС (вкл.)',
    budget: 'Бюджет',
    budgetNotSet: 'Не задан — попробуйте «бюджет до 150000».',
    budgetUsed: 'Использовано бюджета',
    overBy: 'Превышение на {amount}',
    remaining: 'Осталось {amount}',
    reply: 'Ответить',
    yes: 'Да',
    no: 'Нет',
    voiceTitle: 'Голосовая команда',
    voicePrompt: 'Голосовая расшифровка (демо):',
    voiceSample: 'добавь модуль',
    language: 'Язык'
  }
};

/**
 * @param {unknown} value
 * @returns {Locale}
 */
export function normalizeLocale(value) {
  return value === 'ru' ? 'ru' : 'en';
}

/**
 * @param {Locale} locale
 * @param {keyof typeof STRINGS.en} key
 * @param {Record<string, string | number>} [vars]
 */
export function translate(locale, key, vars = {}) {
  const lang = normalizeLocale(locale);
  let text = STRINGS[lang][key] ?? STRINGS.en[key] ?? String(key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

const STORAGE_KEY = 'hc-locale';

/**
 * @returns {Locale}
 */
export function readStoredLocale() {
  try {
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'en';
  }
}

/**
 * @param {Locale} locale
 */
export function writeStoredLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, normalizeLocale(locale));
  } catch {
    /* ignore quota / private mode */
  }
}
