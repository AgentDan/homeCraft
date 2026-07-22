import { useLocale } from '../i18n/LocaleContext.jsx';

/**
 * Compact EN | RU language switcher.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="inline-flex items-center rounded-[10px] border border-[var(--hc-border)] bg-black/40 p-0.5"
      role="group"
      aria-label={t('language')}
    >
      {/** @type {const} */ (['en', 'ru']).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(code)}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
              active
                ? 'bg-[var(--hc-accent)] text-[#04140a]'
                : 'text-[var(--hc-muted)] hover:text-[var(--hc-text)]'
            }`}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
