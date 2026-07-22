import { useEffect, useRef } from 'react';
import { useLocale } from '../i18n/LocaleContext.jsx';

/**
 * @param {{
 *   turns: Array<{ id: string, role: 'user' | 'assistant', text: string }>,
 *   loading?: boolean,
 *   online?: boolean,
 *   tools?: import('react').ReactNode
 * }} props
 */
export function ChatPanel({ turns, loading = false, online = true, tools = null }) {
  const { t } = useLocale();
  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, loading]);

  return (
    <section className="hc-glass-strong flex max-h-[36vh] min-h-[11rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--hc-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
            {t('chat')}
          </h3>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              online ? 'bg-[var(--hc-accent)]' : 'bg-[var(--hc-muted)]'
            }`}
            aria-hidden="true"
          />
        </div>
        {tools}
      </div>

      <div className="hc-scroll flex-1 space-y-2 overflow-auto px-3 py-2.5" aria-live="polite">
        {turns.length === 0 && !loading && (
          <p className="text-xs leading-relaxed text-[var(--hc-muted)]">
            {t('chatEmpty')}
          </p>
        )}

        {turns.map((turn) => (
          <div
            key={turn.id}
            className={
              turn.role === 'user'
                ? 'ml-6 rounded-[12px] bg-[var(--hc-accent)]/15 px-3 py-2 text-sm text-[var(--hc-text)]'
                : 'mr-4 rounded-[12px] border border-[var(--hc-border)] bg-black/35 px-3 py-2 text-sm text-[var(--hc-muted)]'
            }
          >
            {turn.text}
          </div>
        ))}

        {loading && (
          <div className="mr-4 rounded-[12px] border border-[var(--hc-border)] bg-black/35 px-3 py-2 text-xs text-[var(--hc-muted)]">
            {t('thinking')}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </section>
  );
}
