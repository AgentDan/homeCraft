import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext.jsx';

/**
 * @param {{
 *   onSubmit: (command: string, inputChannel?: 'text' | 'voice') => void,
 *   disabled?: boolean
 * }} props
 */
export function CommandInput({ onSubmit, disabled }) {
  const { t } = useLocale();
  const [value, setValue] = useState('');
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    /**
     * @param {KeyboardEvent} event
     */
    function handleKeyDown(event) {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <form className="hc-glass hc-glass--compact px-3 pt-2.5 pb-3" onSubmit={handleSubmit}>
      <label
        htmlFor="command"
        className="mb-1.5 block text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase"
      >
        {t('command')}
        <span className="ml-2 font-normal normal-case tracking-normal text-[var(--hc-muted)]/70">
          {t('spaceHint')}
        </span>
      </label>
      <div className="flex items-center gap-1.5 rounded-[12px] border border-[var(--hc-border)] bg-black/50 p-1 focus-within:border-[var(--hc-accent)]/50">
        <input
          ref={inputRef}
          id="command"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('commandPlaceholder')}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-[var(--hc-text)] outline-none placeholder:text-[var(--hc-muted)]/70 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          className="hc-btn-accent shrink-0 rounded-[10px] px-3.5 py-2 text-xs font-semibold"
        >
          {t('send')}
        </button>
      </div>
    </form>
  );
}
