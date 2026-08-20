/**
 * Desk intent rules.
 *
 * add_module / replace_module use desk product nouns (desk, table, workstation /
 * стол / sto). There is no desk catalog file in the repo, so SKU-prefix regexes
 * are omitted rather than inventing prefixes that do not exist.
 *
 * The other 10 kinds start as copies of kitchen patterns; they may diverge later.
 */
export const deskIntentRules = [
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
          /\b(?:desk|table|workstation)\b/i
        ]
      },
      {
        language: 'ru',
        patterns: [
          /(?:замен|помен|свап)/i,
          /(?:стол|письменн|парт)/i
        ]
      },
      {
        language: 'sr',
        patterns: [
          /(?:zamen|zamijen|замен)/i,
          /(?:\bsto\b|\bstol\b|radni\s+sto|pisać|pisac|писаћ)/i
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
          /\b(?:add|place|install|build|create)\b/i,
          /\b(?:desk|table|workstation)\b/i
        ]
      },
      {
        language: 'ru',
        patterns: [
          /(?:добав|постав|установи|собери|создай)/i,
          /(?:стол|письменн|парт)/i
        ]
      },
      {
        language: 'sr',
        patterns: [
          /(?:dodaj|stavi|ugradi|napravi|kreiraj|додај|стави|угради)/i,
          /(?:\bsto\b|\bstol\b|radni\s+sto|pisać|pisac|писаћ)/i
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
