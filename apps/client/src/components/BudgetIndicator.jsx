import { useLocale } from '../i18n/LocaleContext.jsx';

/**
 * @param {number} value
 * @param {string} locale
 */
function formatEur(value, locale) {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * @param {{
 *   budgetEur?: number | null,
 *   totalEur?: number | null
 * }} props
 */
export function BudgetIndicator({ budgetEur, totalEur }) {
  const { locale, t } = useLocale();

  if (budgetEur == null) {
    return (
      <section className="hc-glass hc-glass--compact px-3 py-2.5">
        <h3 className="mb-1 text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
          {t('budget')}
        </h3>
        <p className="text-xs text-[var(--hc-muted)]">{t('budgetNotSet')}</p>
      </section>
    );
  }

  const spent = totalEur ?? 0;
  const ratio = budgetEur > 0 ? Math.min(spent / budgetEur, 1.35) : 0;
  const over = spent > budgetEur;
  const remaining = budgetEur - spent;
  const fillPct = Math.min(ratio * 100, 100);

  return (
    <section className="hc-glass hc-glass--compact px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
          {t('budget')}
        </h3>
        <span
          className={`text-xs font-semibold tabular-nums ${
            over ? 'text-[var(--hc-danger)]' : 'text-[var(--hc-text)]'
          }`}
        >
          {formatEur(spent, locale)}
          <span className="font-normal text-[var(--hc-muted)]">
            {' '}
            / {formatEur(budgetEur, locale)}
          </span>
        </span>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={Math.round(fillPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('budgetUsed')}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${fillPct}%`,
            background: over ? 'var(--hc-danger)' : 'var(--hc-accent)'
          }}
        />
      </div>

      <p
        className={`mt-1.5 text-[11px] ${
          over ? 'text-[var(--hc-danger)]' : 'text-[var(--hc-muted)]'
        }`}
      >
        {over
          ? t('overBy', { amount: formatEur(spent - budgetEur, locale) })
          : t('remaining', { amount: formatEur(remaining, locale) })}
      </p>
    </section>
  );
}
