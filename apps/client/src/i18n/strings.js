/** @typedef {'en' | 'ru' | 'sr'} Locale */

export const LOCALES = /** @type {const} */ (['en', 'ru', 'sr']);

/** @type {ReadonlySet<string>} */
const SUPPORTED = new Set(LOCALES);

export const SPEECH_LANG = {
  en: 'en-US',
  ru: 'ru-RU',
  sr: 'sr-RS'
};

/** @type {Record<Locale, string>} */
export const NUMBER_LOCALE = {
  en: 'en-US',
  ru: 'ru-RU',
  sr: 'sr-RS'
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
    voiceListening: 'Listening… tap to stop',
    voiceUnsupported: 'Voice input is not supported in this browser',
    voiceError: 'Voice input failed ({error})',
    speakReplies: 'Speak replies',
    muteSpeech: 'Mute speech',
    unmuteSpeech: 'Unmute speech',
    language: 'Language',
    versionConflict: 'Version conflict (server is at {current}). Retry the command.',
    downloadSpec: 'Download specification PDF'
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
    voiceListening: 'Слушаю… нажмите, чтобы остановить',
    voiceUnsupported: 'Голосовой ввод не поддерживается в этом браузере',
    voiceError: 'Ошибка голосового ввода ({error})',
    speakReplies: 'Озвучивать ответы',
    muteSpeech: 'Выключить озвучку',
    unmuteSpeech: 'Включить озвучку',
    language: 'Язык',
    versionConflict: 'Конфликт версий (на сервере {current}). Повторите команду.',
    downloadSpec: 'Скачать спецификацию PDF'
  },
  sr: {
    command: 'Komanda',
    spaceHint: 'Razmak',
    commandPlaceholder: 'dodaj ormar 600 mm',
    send: 'Pošalji',
    chat: 'Ćaskanje',
    chatEmpty: 'Opisite šta želite — na primer „dodaj ormar 600 mm”.',
    thinking: 'Razmišljam…',
    done: 'Gotovo.',
    billOfMaterials: 'Specifikacija',
    noPricedModules: 'Još nema modula sa cenom.',
    item: 'Stavka',
    qty: 'Kol.',
    total: 'Ukupno',
    subtotal: 'Međuzbir',
    vatIncl: 'PDV (uklj.)',
    budget: 'Budžet',
    budgetNotSet: 'Nije postavljen — probate „budžet do 150000”.',
    overBy: 'Prekoračenje za {amount}',
    remaining: 'Preostalo {amount}',
    budgetUsed: 'Iskorišćen budžet',
    reply: 'Odgovori',
    yes: 'Da',
    no: 'Ne',
    voiceTitle: 'Glasovna komanda',
    voiceListening: 'Slušam… dodirnite da zaustavite',
    voiceUnsupported: 'Glasovni unos nije podržan u ovom pregledaču',
    voiceError: 'Glasovni unos nije uspeo ({error})',
    speakReplies: 'Izgovori odgovore',
    muteSpeech: 'Isključi govor',
    unmuteSpeech: 'Uključi govor',
    language: 'Jezik',
    versionConflict: 'Konflikt verzija (server je na {current}). Ponovite komandu.',
    downloadSpec: 'Preuzmi specifikaciju PDF'
  }
};

/**
 * @param {unknown} value
 * @returns {Locale}
 */
export function normalizeLocale(value) {
  return typeof value === 'string' && SUPPORTED.has(value)
    ? /** @type {Locale} */ (value)
    : 'en';
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

/**
 * @param {Locale} locale
 * @param {string | undefined} instanceId
 * @param {string} sku
 */
export function replaceSuggestionCommand(locale, instanceId, sku) {
  if (locale === 'ru') {
    return instanceId ? `замени ${instanceId} на ${sku}` : `замени на ${sku}`;
  }
  if (locale === 'sr') {
    return instanceId ? `zameni ${instanceId} sa ${sku}` : `zameni sa ${sku}`;
  }
  return instanceId ? `replace ${instanceId} with ${sku}` : `replace with ${sku}`;
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
