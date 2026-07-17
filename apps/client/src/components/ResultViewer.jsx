/**
 * @param {{
 *   response: unknown,
 *   error: string | null,
 *   health: unknown,
 *   compact?: boolean
 * }} props
 */
export function ResultViewer({ response, error, health, compact = false }) {
  const payload = response ?? health;

  return (
    <section
      className={`hc-glass-strong flex flex-col overflow-hidden ${
        compact ? 'max-h-[28vh] min-h-0' : 'max-h-[42vh] min-h-[180px]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--hc-border)] px-3 py-2">
        <h3 className="text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
          Health
        </h3>
        <span
          className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-[var(--hc-danger)]' : 'bg-[var(--hc-accent)]'}`}
          aria-hidden="true"
        />
      </div>
      <div className="hc-scroll flex-1 overflow-auto px-3 py-2">
        {error && (
          <pre className="hc-mono mb-2 whitespace-pre-wrap text-[10px] leading-snug text-[var(--hc-danger)]">
            {error}
          </pre>
        )}
        {payload != null ? (
          <pre className="hc-mono whitespace-pre-wrap text-[10px] leading-snug text-sky-300/90">
            {JSON.stringify(payload, null, 2)}
          </pre>
        ) : (
          !error && (
            <p className="text-xs text-[var(--hc-muted)]">Waiting for server…</p>
          )
        )}
      </div>
    </section>
  );
}
