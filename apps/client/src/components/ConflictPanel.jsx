/**
 * @param {{
 *   compatibility: {
 *     valid?: boolean,
 *     conflicts?: Array<{
 *       kind: string,
 *       message: string,
 *       instanceIds?: string[],
 *       suggestedSkus?: string[]
 *     }>
 *   } | null | undefined,
 *   onSuggestion?: (suggestion: { sku: string, instanceId?: string }) => void,
 *   disabled?: boolean
 * }} props
 */
export function ConflictPanel({ compatibility, onSuggestion, disabled = false }) {
  const conflicts = compatibility?.conflicts ?? [];
  if (conflicts.length === 0) return null;

  return (
    <section className="hc-glass hc-glass--compact border-[rgba(255,77,79,0.35)] px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid h-5 w-5 place-items-center rounded-full bg-[var(--hc-danger)]/15 text-[var(--hc-danger)]"
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </span>
        <h3 className="text-[11px] font-medium tracking-wide text-[var(--hc-danger)] uppercase">
          {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
        </h3>
      </div>

      <ul className="space-y-2">
        {conflicts.map((conflict, index) => {
          const suggestions = conflict.suggestedSkus ?? [];
          const instanceId = conflict.instanceIds?.[0];
          return (
          <li key={`${conflict.kind}-${index}`} className="text-xs leading-snug text-[var(--hc-muted)]">
            <p className="text-[var(--hc-text)]">{conflict.message}</p>
            {suggestions.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] tracking-wide text-[var(--hc-muted)] uppercase">
                  Try
                </span>
                {suggestions.map((sku) => (
                  <button
                    key={sku}
                    type="button"
                    disabled={disabled || !onSuggestion}
                    onClick={() => onSuggestion?.({ sku, instanceId })}
                    className="hc-pill px-2 py-0.5 text-[11px]"
                    title={
                      instanceId
                        ? `Replace ${instanceId} with ${sku}`
                        : `Replace with ${sku}`
                    }
                  >
                    {sku}
                  </button>
                ))}
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}
