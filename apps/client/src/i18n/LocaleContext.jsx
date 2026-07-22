import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  normalizeLocale,
  readStoredLocale,
  SPEECH_LANG,
  translate,
  writeStoredLocale
} from './strings.js';

/** @typedef {import('./strings.js').Locale} Locale */

const LocaleContext = createContext(
  /** @type {{
   *   locale: Locale,
   *   setLocale: (locale: Locale) => void,
   *   t: (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => string,
   *   speechLang: string
   * }} */ ({
    locale: 'en',
    setLocale: () => {},
    t: (key, vars) => translate('en', key, vars),
    speechLang: SPEECH_LANG.en
  })
);

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() =>
    typeof window === 'undefined' ? 'en' : readStoredLocale()
  );

  /**
   * @param {Locale} next
   */
  function setLocale(next) {
    setLocaleState(normalizeLocale(next));
  }

  useEffect(() => {
    writeStoredLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      speechLang: SPEECH_LANG[locale]
    }),
    [locale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
