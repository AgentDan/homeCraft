import { useCallback, useRef, useState } from 'react';
import { postBehaviorSignal } from '../api/client.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

/** Hover duration before `hover_long` is emitted (configurator only). */
export const HOVER_LONG_MS = 2000;

/**
 * Configurator variant actions → Observation BehaviorSignal (4 event types only).
 *
 * @param {{
 *   clientId: string,
 *   options: Array<{ id: string, label: string, thumbnailUrl?: string }>,
 *   onSelect: (option: { id: string, label: string }) => void
 * }} props
 */
export function VariantOptions({ clientId, options, onSelect }) {
  const { t } = useLocale();
  const [compareIds, setCompareIds] = useState(/** @type {string[]} */ ([]));
  const hoverStartedAt = useRef(/** @type {Map<string, number>} */ (new Map()));
  const hoverFired = useRef(/** @type {Set<string>} */ (new Set()));
  const hoverTimers = useRef(/** @type {Map<string, ReturnType<typeof setTimeout>>} */ (new Map()));

  const emit = useCallback(
    /**
     * @param {'click' | 'hover_long' | 'reject_variant' | 'compare'} eventType
     * @param {string} targetId
     * @param {number} durationMs
     */
    async (eventType, targetId, durationMs) => {
      try {
        await postBehaviorSignal({
          clientId,
          eventType,
          targetId,
          durationMs
        });
      } catch {
        // best-effort; never block UI
      }
    },
    [clientId]
  );

  const clearHover = useCallback((optionId) => {
    const timer = hoverTimers.current.get(optionId);
    if (timer) clearTimeout(timer);
    hoverTimers.current.delete(optionId);
    hoverStartedAt.current.delete(optionId);
  }, []);

  if (!options?.length) return null;

  return (
    <div className="hc-glass space-y-2 px-3 py-2" aria-label={t('variants')}>
      <div className="text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
        {t('variants')}
      </div>
      <ul className="space-y-2">
        {options.map((option) => {
          const comparing = compareIds.includes(option.id);
          return (
            <li
              key={option.id}
              className="flex items-start gap-2 rounded-[10px] border border-[var(--hc-border)] bg-black/30 px-2 py-2"
              onPointerEnter={() => {
                if (hoverFired.current.has(option.id)) return;
                hoverStartedAt.current.set(option.id, Date.now());
                const timer = setTimeout(() => {
                  const started = hoverStartedAt.current.get(option.id);
                  if (started == null) return;
                  const durationMs = Date.now() - started;
                  if (durationMs >= HOVER_LONG_MS && !hoverFired.current.has(option.id)) {
                    hoverFired.current.add(option.id);
                    void emit('hover_long', option.id, durationMs);
                  }
                }, HOVER_LONG_MS);
                hoverTimers.current.set(option.id, timer);
              }}
              onPointerLeave={() => clearHover(option.id)}
            >
              {option.thumbnailUrl ? (
                <img
                  src={option.thumbnailUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="w-full text-left text-sm text-[var(--hc-text)] hover:text-[var(--hc-accent)]"
                  onClick={() => {
                    void emit('click', option.id, 0);
                    onSelect(option);
                  }}
                >
                  {option.label}
                </button>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-[10px] text-[var(--hc-muted)] hover:bg-white/10 hover:text-[var(--hc-text)]"
                    onClick={() => {
                      void emit('reject_variant', option.id, 0);
                    }}
                  >
                    {t('rejectVariant')}
                  </button>
                  <button
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] hover:bg-white/10 ${
                      comparing
                        ? 'text-[var(--hc-accent)]'
                        : 'text-[var(--hc-muted)] hover:text-[var(--hc-text)]'
                    }`}
                    onClick={() => {
                      setCompareIds((current) => {
                        const next = current.includes(option.id)
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id].slice(-2);
                        if (next.length === 2) {
                          void emit('compare', next.join('|'), 0);
                        }
                        return next;
                      });
                    }}
                  >
                    {comparing ? t('compareSelected') : t('compareVariant')}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
