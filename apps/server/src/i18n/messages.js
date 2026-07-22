/** @typedef {'en' | 'ru'} Language */

/**
 * @param {unknown} language
 * @returns {Language}
 */
export function normalizeLanguage(language) {
  return language === 'ru' ? 'ru' : 'en';
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
