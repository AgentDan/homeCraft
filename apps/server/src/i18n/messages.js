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
    helpFallback: 'Commands',
    helpExplanation: '',
    catalogIntro: 'Catalog {version} ({count})',
    catalogUnavailable: 'Catalog unavailable.',
    nothingToUndo: 'There is nothing to undo. Describe what you want to change.',
    nothingToRedo: 'There is nothing to redo. Undo a change first.',
    undone: 'The last change was undone.',
    redone: 'The undone change was restored.',
    branchCreated: 'Created branch "{name}" and switched to it.',
    branchSwitched: 'Switched to branch "{name}".',
    branchEmpty: 'Add modules before creating a branch.',
    branchExists:
      'Branch "{name}" already exists. Say "switch branch {name}" to open it.',
    branchNotFound:
      'Branch "{name}" was not found. Create it with "create branch {name}".',
    branchSwitchClarify:
      'Which branch should I open? For example "switch branch main".',
    budgetClarify: 'Enter a numeric budget, for example "budget up to 150000".',
    starterKitchenAdded: 'Starter kitchen added: {count} modules.',
    moduleAdded: 'Module {sku} added.',
    moduleRemoved: 'Module {instanceId} removed.',
    moduleReplaced: 'Module {instanceId} replaced with {sku}.',
    finishSelected: 'Finish {finishId} selected for {instanceId}.',
    budgetSet: 'Budget set to €{budgetEur}.',
    priceCalculated: 'Project cost calculated.',
    explainIntent: 'Handled as {kind}.',
    explainBom:
      'Estimate: {lineCount} line(s), subtotal €{subtotalEur}, total €{totalEur}.',
    explainPolicyApplied:
      'Policy v{policyVersion} chose {sku} (score {score}, gap {gap}).',
    explainPolicyNearTie:
      'Policy v{policyVersion} near-tie (gap {gap}); choose among the options.',
    explainConflict: 'Compatibility reported {count} conflict(s).',
    changesRejected: 'Changes rejected: {details}',
    candidatesNearTie:
      'The change caused a conflict ({details}). {count} alternatives are close in score (gap {gap}) — please choose:',
    candidateOptionScored:
      'Option {index}: replace {instanceId} with {sku} — total €{totalEur} (score {score})',
    policyApplied:
      'Conflict resolved by policy: replaced {instanceId} with {sku} (total €{totalEur}).',
    budgetExceeded: 'The cost exceeds the budget by €{over}.',
    clarifyAddModule:
      'Which module should be added? Enter a type and width, for example "base cabinet 600".',
    clarifyNothingToRemove: 'The project has no module that can be removed.',
    clarifyReplace:
      'Specify a module and SKU to swap, for example "replace module-1 with BASE-400".',
    clarifyMissingModule: 'Module {target} is not in the project.',
    clarifyFinish:
      'Specify a finish and module, for example "change the last cabinet to oak".',
    versionConflict:
      'Version conflict: client expected {expected}, server is at {current}. Refresh and retry.',
    exportEmpty: 'Add modules before exporting a specification PDF.',
    exportReady:
      'Specification PDF ready (plan v{version}, catalog {catalog}).',
    exportExplanation: 'Frozen export checksum {sha}… (reused: {reused}).',
    journeyAskClientName:
      'Hello! I am your HomeCraft consultant. What is your name?',
    journeyAskProjectGoal:
      'Nice to meet you. What kitchen are we planning — for example a small galley or a full remodel?',
    journeyAskRoomWidth:
      'Let us survey the room. What is the room width? For example "3 m" or "3000 mm".',
    journeyAskRoomDepth:
      'What is the room depth? For example "4 m" or "4000 mm".',
    journeyAskHasKidsOrPets:
      'Do you have kids or pets at home? Answer "yes" or "no".',
    journeyAskFacadeMaterial:
      'For a home with kids or pets, which facade feel do you prefer: durable, soft, or mixed?',
    journeyAskShoppingHabit:
      'How do you usually shop for furniture: browse, decide_fast, or research?',
    journeyAskSocialStyle:
      'What social style fits this kitchen: private, hosting, or family?',
    journeyAskBudgetEur:
      'What budget in euro should we aim for? For example "15000".',
    journeyReask: 'I did not catch that. {question}',
    journeyFreeMode:
      'Switched to free mode. Ask me to add modules or change the plan anytime. Say hello again if you want guided questions.',
    journeyComplete:
      'Room survey is complete. You can add modules, set a budget, or ask for the price.',
    dp4PrimaryRecommendation:
      'Based on your answers, I recommend {sku}.',
    dp4BehaviorAlternative:
      'You also focused on {alts} — I am keeping that as an alternative only.',
    dp4ConfigApplied:
      '{speech} Added {sku}. Project total €{totalEur}.',
    dp4ConfigRejected:
      '{speech} I could not apply that configuration yet: {reason}'
  },
  ru: {
    commandProcessed: 'Команда обработана.',
    commandCompleted: 'Команда выполнена.',
    unknownIntent: 'Команда не распознана. Переформулируйте запрос.',
    unknownExplanation: 'Распознавание намерения вернуло unknown.',
    helpFallback: 'Команды',
    helpExplanation: '',
    catalogIntro: 'Каталог {version} ({count})',
    catalogUnavailable: 'Каталог недоступен.',
    nothingToUndo: 'Нечего отменять. Опишите, что хотите изменить.',
    nothingToRedo: 'Нечего повторить. Сначала отмените изменение.',
    undone: 'Последнее изменение отменено.',
    redone: 'Отменённое изменение восстановлено.',
    branchCreated: 'Создана ветка «{name}» и выполнен переход на неё.',
    branchSwitched: 'Переключение на ветку «{name}».',
    branchEmpty: 'Сначала добавьте модули, затем создайте ветку.',
    branchExists:
      'Ветка «{name}» уже есть. Скажите «переключи ветку {name}».',
    branchNotFound:
      'Ветка «{name}» не найдена. Создайте её командой «создай ветку {name}».',
    branchSwitchClarify:
      'На какую ветку переключиться? Например «переключи ветку main».',
    budgetClarify: 'Укажите числовой бюджет, например «бюджет до 150000».',
    starterKitchenAdded: 'Стартовая кухня добавлена: {count} модулей.',
    moduleAdded: 'Модуль {sku} добавлен.',
    moduleRemoved: 'Модуль {instanceId} удалён.',
    moduleReplaced: 'Модуль {instanceId} заменён на {sku}.',
    finishSelected: 'Отделка {finishId} выбрана для {instanceId}.',
    budgetSet: 'Бюджет установлен: €{budgetEur}.',
    priceCalculated: 'Стоимость проекта рассчитана.',
    explainIntent: 'Обработано как {kind}.',
    explainBom:
      'Смета: {lineCount} поз., сумма €{subtotalEur}, итого €{totalEur}.',
    explainPolicyApplied:
      'Policy v{policyVersion} выбрала {sku} (оценка {score}, разрыв {gap}).',
    explainPolicyNearTie:
      'Policy v{policyVersion}: близкие оценки (разрыв {gap}); выберите вариант.',
    explainConflict: 'Совместимость: {count} конфликт(ов).',
    changesRejected: 'Изменения отклонены: {details}',
    candidatesNearTie:
      'Изменение вызвало конфликт ({details}). {count} альтернативы близки по оценке (разрыв {gap}) — выберите:',
    candidateOptionScored:
      'Вариант {index}: заменить {instanceId} на {sku} — итого €{totalEur} (оценка {score})',
    policyApplied:
      'Конфликт разрешён политикой: {instanceId} заменён на {sku} (итого €{totalEur}).',
    budgetExceeded: 'Стоимость превышает бюджет на €{over}.',
    clarifyAddModule:
      'Какой модуль добавить? Укажите тип и ширину, например «шкаф 600».',
    clarifyNothingToRemove: 'В проекте нет модуля, который можно удалить.',
    clarifyReplace:
      'Укажите модуль и SKU для замены, например «замени module-1 на BASE-400».',
    clarifyMissingModule: 'Модуля {target} нет в проекте.',
    clarifyFinish:
      'Укажите отделку и модуль, например «сделай фасад дуб».',
    versionConflict:
      'Конфликт версий: клиент ожидал {expected}, на сервере {current}. Обновите и повторите.',
    exportEmpty: 'Добавьте модули перед экспортом спецификации в PDF.',
    exportReady:
      'PDF спецификации готов (план v{version}, каталог {catalog}).',
    exportExplanation: 'Замороженный экспорт, checksum {sha}… (повтор: {reused}).',
    journeyAskClientName:
      'Здравствуйте! Я консультант HomeCraft. Как вас зовут?',
    journeyAskProjectGoal:
      'Приятно познакомиться. Какую кухню планируем — например небольшую линейную или полный ремонт?',
    journeyAskRoomWidth:
      'Давайте обследуем помещение. Какая ширина комнаты? Например «3 м» или «3000 мм».',
    journeyAskRoomDepth:
      'Какая глубина комнаты? Например «4 м» или «4000 мм».',
    journeyAskHasKidsOrPets:
      'Дома есть дети или питомцы? Ответьте «да» или «нет».',
    journeyAskFacadeMaterial:
      'Для дома с детьми или питомцами какой фасад предпочитаете: durable, soft или mixed?',
    journeyAskShoppingHabit:
      'Как обычно выбираете мебель: browse, decide_fast или research?',
    journeyAskSocialStyle:
      'Какой социальный стиль кухни: private, hosting или family?',
    journeyAskBudgetEur:
      'Какой бюджет в евро закладываем? Например «15000».',
    journeyReask: 'Не расслышал. {question}',
    journeyFreeMode:
      'Свободный режим. Можно сразу добавлять модули и менять план. Для guided-вопросов просто продолжите диалог с именем.',
    journeyComplete:
      'Обследование комнаты завершено. Можно добавлять модули, задать бюджет или спросить цену.',
    dp4PrimaryRecommendation:
      'По вашим ответам рекомендую {sku}.',
    dp4BehaviorAlternative:
      'Вы также задерживались на {alts} — оставляю это только как альтернативу.',
    dp4ConfigApplied:
      '{speech} Добавлен {sku}. Итого по проекту €{totalEur}.',
    dp4ConfigRejected:
      '{speech} Пока не удалось применить конфигурацию: {reason}'
  },
  sr: {
    commandProcessed: 'Komanda je obrađena.',
    commandCompleted: 'Komanda je izvršena.',
    unknownIntent: 'Komanda nije prepoznata. Preformulirajte zahtev.',
    unknownExplanation: 'Prepoznavanje namere vratilo je unknown.',
    helpFallback: 'Komande',
    helpExplanation: '',
    catalogIntro: 'Katalog {version} ({count})',
    catalogUnavailable: 'Katalog nije dostupan.',
    nothingToUndo: 'Nema šta da se poništi. Opisite šta želite da promenite.',
    nothingToRedo: 'Nema šta da se ponovi. Prvo poništite izmenu.',
    undone: 'Poslednja izmena je poništena.',
    redone: 'Poništena izmena je vraćena.',
    branchCreated: 'Kreirana je grana „{name}” i prebačeno je na nju.',
    branchSwitched: 'Prebaceno na granu „{name}”.',
    branchEmpty: 'Prvo dodajte module, pa kreirajte granu.',
    branchExists:
      'Grana „{name}” već postoji. Recite „prebaci granu {name}”.',
    branchNotFound:
      'Grana „{name}” nije pronađena. Kreirajte je sa „kreiraj granu {name}”.',
    branchSwitchClarify:
      'Na koju granu da prebacim? Na primer „prebaci granu main”.',
    budgetClarify: 'Unesite brojčani budžet, na primer „budžet do 150000”.',
    starterKitchenAdded: 'Početna kuhinja dodata: {count} modula.',
    moduleAdded: 'Modul {sku} je dodat.',
    moduleRemoved: 'Modul {instanceId} je uklonjen.',
    moduleReplaced: 'Modul {instanceId} je zamenjen sa {sku}.',
    finishSelected: 'Završna obrada {finishId} izabrana za {instanceId}.',
    budgetSet: 'Budžet je postavljen na €{budgetEur}.',
    priceCalculated: 'Cena projekta je izračunata.',
    explainIntent: 'Obrađeno kao {kind}.',
    explainBom:
      'Predračun: {lineCount} stavki, međuzbir €{subtotalEur}, ukupno €{totalEur}.',
    explainPolicyApplied:
      'Policy v{policyVersion} izabrala {sku} (ocena {score}, razlika {gap}).',
    explainPolicyNearTie:
      'Policy v{policyVersion}: bliske ocene (razlika {gap}); izaberite opciju.',
    explainConflict: 'Kompatibilnost: {count} konflikt(a).',
    changesRejected: 'Izmene odbijene: {details}',
    candidatesNearTie:
      'Izmena je izazvala konflikt ({details}). {count} alternative su blizu po oceni (razlika {gap}) — izaberite:',
    candidateOptionScored:
      'Opcija {index}: zameni {instanceId} sa {sku} — ukupno €{totalEur} (ocena {score})',
    policyApplied:
      'Konflikt rešen politikom: {instanceId} zamenjen sa {sku} (ukupno €{totalEur}).',
    budgetExceeded: 'Cena premašuje budžet za €{over}.',
    clarifyAddModule:
      'Koji modul da dodam? Unesite tip i širinu, na primer „ormar 600”.',
    clarifyNothingToRemove: 'U projektu nema modula koji se može ukloniti.',
    clarifyReplace:
      'Navedite modul i SKU za zamenu, na primer „zameni module-1 sa BASE-400”.',
    clarifyMissingModule: 'Modul {target} nije u projektu.',
    clarifyFinish:
      'Navedite završnu obradu i modul, na primer „uradi fasadu hrast”.',
    versionConflict:
      'Konflikt verzija: klijent očekuje {expected}, server je na {current}. Osvežite i pokušajte ponovo.',
    exportEmpty: 'Dodajte module pre izvoza specifikacije u PDF.',
    exportReady:
      'PDF specifikacije je spreman (plan v{version}, katalog {catalog}).',
    exportExplanation: 'Zamrznuti izvoz, checksum {sha}… (ponovo: {reused}).',
    journeyAskClientName:
      'Zdravo! Ja sam HomeCraft konsultant. Kako se zovete?',
    journeyAskProjectGoal:
      'Drago mi je. Kakvu kuhinju planiramo — na primer malu linijsku ili kompletan remont?',
    journeyAskRoomWidth:
      'Hajde da snimimo prostor. Koja je širina sobe? Na primer „3 m” ili „3000 mm”.',
    journeyAskRoomDepth:
      'Koja je dubina sobe? Na primer „4 m” ili „4000 mm”.',
    journeyAskHasKidsOrPets:
      'Imate li decu ili kućne ljubimce? Odgovorite „da” ili „ne”.',
    journeyAskFacadeMaterial:
      'Za dom sa decom ili ljubimcima koji fasad preferirate: durable, soft ili mixed?',
    journeyAskShoppingHabit:
      'Kako obično birate nameštaj: browse, decide_fast ili research?',
    journeyAskSocialStyle:
      'Koji društveni stil odgovara kuhinji: private, hosting ili family?',
    journeyAskBudgetEur:
      'Koji budžet u eurima ciljamo? Na primer „15000”.',
    journeyReask: 'Nisam razumeo. {question}',
    journeyFreeMode:
      'Slobodan režim. Možete odmah dodavati module i menjati plan.',
    journeyComplete:
      'Snimanje sobe je završeno. Možete dodavati module, postaviti budžet ili pitati za cenu.',
    dp4PrimaryRecommendation:
      'Na osnovu odgovora preporučujem {sku}.',
    dp4BehaviorAlternative:
      'Zadržali ste se i na {alts} — to ostaje samo alternativa.',
    dp4ConfigApplied:
      '{speech} Dodat je {sku}. Ukupno €{totalEur}.',
    dp4ConfigRejected:
      '{speech} Još ne mogu da primenim konfiguraciju: {reason}'
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

/** Short command titles shown by `help` / `commands` (one per line). */
const COMMAND_LIST = {
  en: [
    'add',
    'remove',
    'replace',
    'finish',
    'budget',
    'price',
    'export',
    'undo',
    'redo',
    'branch',
    'kitchen',
    'catalog'
  ],
  ru: [
    'добавь',
    'удали',
    'замени',
    'фасад',
    'бюджет',
    'цена',
    'экспорт',
    'отмена',
    'повтор',
    'ветка',
    'кухня',
    'каталог'
  ],
  sr: [
    'dodaj',
    'ukloni',
    'zameni',
    'fasada',
    'budžet',
    'cena',
    'izvoz',
    'poništi',
    'ponovi',
    'grana',
    'kuhinja',
    'katalog'
  ]
};

/**
 * Compact column of available command titles.
 * @param {unknown} language
 */
export function getLocalizedCommandList(language) {
  const lang = normalizeLanguage(language);
  return (COMMAND_LIST[lang] ?? COMMAND_LIST.en).join('\n');
}
