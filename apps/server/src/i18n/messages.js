/** @typedef {'en' | 'ru' | 'sr'} Language */

/** @type {ReadonlySet<string>} */
const SUPPORTED = new Set(['en', 'ru', 'sr']);

/**
 * @param {unknown} language
 * @returns {Language}
 */
export function normalizeLanguage(language) {
  return typeof language === 'string' && SUPPORTED.has(language)
    ? /** @type {Language} */ (language)
    : 'en';
}

const MESSAGES = {
  en: {
    commandProcessed: 'Command processed.',
    commandCompleted: 'Command completed.',
    unknownIntent: 'The command was not understood. Please rephrase it.',
    unknownExplanation: 'Intent detection returned unknown.',
    helpFallback: 'Describe the kitchen by text or voice.',
    helpIntro: 'I can help you assemble a kitchen from the demo catalog.',
    helpExamplesPrefix: 'Example commands',
    helpExplanation: 'Available commands were provided by the Help service.',
    nothingToUndo: 'There is nothing to undo. Describe what you want to change.',
    nothingToRedo: 'There is nothing to redo. Undo a change first.',
    undone: 'The last change was undone.',
    redone: 'The undone change was restored.',
    budgetClarify: 'Enter a numeric budget, for example "budget up to 150000".',
    starterKitchenAdded: 'Starter kitchen added: {count} modules.',
    moduleAdded: 'Module {sku} added.',
    moduleRemoved: 'Module {instanceId} removed.',
    moduleReplaced: 'Module {instanceId} replaced with {sku}.',
    finishSelected: 'Finish {finishId} selected for {instanceId}.',
    budgetSet: 'Budget set to €{budgetEur}.',
    priceCalculated: 'Project cost calculated.',
    changesRejected: 'Changes rejected: {details}',
    budgetExceeded: 'The cost exceeds the budget by €{over}.',
    clarifyAddModule:
      'Which module should be added? Enter a type and width, for example "base cabinet 600".',
    clarifyNothingToRemove: 'The project has no module that can be removed.',
    clarifyReplace:
      'Specify a module and SKU to swap, for example "replace module-1 with BASE-400".',
    clarifyMissingModule: 'Module {target} is not in the project.',
    clarifyFinish:
      'Specify a finish and module, for example "change the last cabinet to oak".'
  },
  ru: {
    commandProcessed: 'Команда обработана.',
    commandCompleted: 'Команда выполнена.',
    unknownIntent: 'Команда не распознана. Переформулируйте запрос.',
    unknownExplanation: 'Распознавание намерения вернуло unknown.',
    helpFallback: 'Опишите кухню текстом или голосом.',
    helpIntro: 'Я помогу собрать кухню из демо-каталога.',
    helpExamplesPrefix: 'Примеры команд',
    helpExplanation: 'Список доступных команд предоставлен сервисом помощи.',
    nothingToUndo: 'Нечего отменять. Опишите, что хотите изменить.',
    nothingToRedo: 'Нечего повторить. Сначала отмените изменение.',
    undone: 'Последнее изменение отменено.',
    redone: 'Отменённое изменение восстановлено.',
    budgetClarify: 'Укажите числовой бюджет, например «бюджет до 150000».',
    starterKitchenAdded: 'Стартовая кухня добавлена: {count} модулей.',
    moduleAdded: 'Модуль {sku} добавлен.',
    moduleRemoved: 'Модуль {instanceId} удалён.',
    moduleReplaced: 'Модуль {instanceId} заменён на {sku}.',
    finishSelected: 'Отделка {finishId} выбрана для {instanceId}.',
    budgetSet: 'Бюджет установлен: €{budgetEur}.',
    priceCalculated: 'Стоимость проекта рассчитана.',
    changesRejected: 'Изменения отклонены: {details}',
    budgetExceeded: 'Стоимость превышает бюджет на €{over}.',
    clarifyAddModule:
      'Какой модуль добавить? Укажите тип и ширину, например «шкаф 600».',
    clarifyNothingToRemove: 'В проекте нет модуля, который можно удалить.',
    clarifyReplace:
      'Укажите модуль и SKU для замены, например «замени module-1 на BASE-400».',
    clarifyMissingModule: 'Модуля {target} нет в проекте.',
    clarifyFinish:
      'Укажите отделку и модуль, например «сделай фасад дуб».'
  },
  sr: {
    commandProcessed: 'Komanda je obrađena.',
    commandCompleted: 'Komanda je izvršena.',
    unknownIntent: 'Komanda nije prepoznata. Preformulirajte zahtev.',
    unknownExplanation: 'Prepoznavanje namere vratilo je unknown.',
    helpFallback: 'Opisite kuhinju tekstom ili glasom.',
    helpIntro: 'Mogu da pomognem da sastavite kuhinju iz demo kataloga.',
    helpExamplesPrefix: 'Primeri komandi',
    helpExplanation: 'Lista dostupnih komandi je dobijena od Help servisa.',
    nothingToUndo: 'Nema šta da se poništi. Opisite šta želite da promenite.',
    nothingToRedo: 'Nema šta da se ponovi. Prvo poništite izmenu.',
    undone: 'Poslednja izmena je poništena.',
    redone: 'Poništena izmena je vraćena.',
    budgetClarify: 'Unesite brojčani budžet, na primer „budžet do 150000”.',
    starterKitchenAdded: 'Početna kuhinja dodata: {count} modula.',
    moduleAdded: 'Modul {sku} je dodat.',
    moduleRemoved: 'Modul {instanceId} je uklonjen.',
    moduleReplaced: 'Modul {instanceId} je zamenjen sa {sku}.',
    finishSelected: 'Završna obrada {finishId} izabrana za {instanceId}.',
    budgetSet: 'Budžet je postavljen na €{budgetEur}.',
    priceCalculated: 'Cena projekta je izračunata.',
    changesRejected: 'Izmene odbijene: {details}',
    budgetExceeded: 'Cena premašuje budžet za €{over}.',
    clarifyAddModule:
      'Koji modul da dodam? Unesite tip i širinu, na primer „ormar 600”.',
    clarifyNothingToRemove: 'U projektu nema modula koji se može ukloniti.',
    clarifyReplace:
      'Navedite modul i SKU za zamenu, na primer „zameni module-1 sa BASE-400”.',
    clarifyMissingModule: 'Modul {target} nije u projektu.',
    clarifyFinish:
      'Navedite završnu obradu i modul, na primer „uradi fasadu hrast”.'
  }
};

/**
 * @param {unknown} language
 * @param {keyof typeof MESSAGES.en} key
 * @param {Record<string, string | number>} [vars]
 */
export function t(language, key, vars = {}) {
  const lang = normalizeLanguage(language);
  let text = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? String(key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

const HELP_EXAMPLES = {
  en: [
    '"replace module-1 with BASE-400"',
    '"add base cabinet 600"',
    '"add sink cabinet 800"',
    '"change the last cabinet to oak"',
    '"remove the last module"',
    '"show price"',
    '"budget up to 150000"',
    '"add kitchen cabinet 3x4"',
    '"undo" or "redo"'
  ],
  ru: [
    '«замени module-1 на BASE-400»',
    '«добавь шкаф 600»',
    '«добавь мойку 800»',
    '«сделай фасад дуб»',
    '«удали последний модуль»',
    '«покажи цену»',
    '«бюджет до 150000»',
    '«кухня 3x4»',
    '«отмена» или «повтор»'
  ],
  sr: [
    '„zameni module-1 sa BASE-400”',
    '„dodaj ormar 600”',
    '„dodaj sudoper 800”',
    '„uradi fasadu hrast”',
    '„ukloni poslednji modul”',
    '„pokaži cenu”',
    '„budžet do 150000”',
    '„kuhinja 3x4”',
    '„poništi” ili „ponovi”'
  ]
};

/**
 * @param {unknown} language
 */
export function getLocalizedHelpMessage(language) {
  const lang = normalizeLanguage(language);
  return [
    t(lang, 'helpIntro'),
    `${t(lang, 'helpExamplesPrefix')}: ${HELP_EXAMPLES[lang].join('; ')}.`
  ].join(' ');
}
