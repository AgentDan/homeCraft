/**
 * @param {number} value
 */
function formatEur(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * @param {{
 *   bom: {
 *     lines?: Array<{
 *       sku: string,
 *       name: string,
 *       quantity: number,
 *       unitPriceEur: number,
 *       lineTotalEur: number,
 *       finishId?: string
 *     }>,
 *     subtotalEur?: number,
 *     vatEur?: number,
 *     totalEur?: number,
 *     catalogSnapshotId?: string
 *   } | null | undefined
 * }} props
 */
export function BomPanel({ bom }) {
  const lines = bom?.lines ?? [];
  if (!bom || lines.length === 0) {
    return (
      <section className="hc-glass hc-glass--compact px-3 py-2.5">
        <h3 className="mb-1 text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
          Bill of materials
        </h3>
        <p className="text-xs text-[var(--hc-muted)]">No priced modules yet.</p>
      </section>
    );
  }

  return (
    <section className="hc-glass hc-glass--compact max-h-56 overflow-auto px-3 py-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-wide text-[var(--hc-muted)] uppercase">
          Bill of materials
        </h3>
        <span className="font-mono text-[10px] text-[var(--hc-muted)]">
          {bom.catalogSnapshotId}
        </span>
      </div>

      <table className="w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="text-[10px] tracking-wide text-[var(--hc-muted)] uppercase">
            <th className="pb-1 font-medium">Item</th>
            <th className="pb-1 pr-1 text-right font-medium">Qty</th>
            <th className="pb-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`${line.sku}:${line.finishId ?? ''}`} className="align-top text-[var(--hc-text)]">
              <td className="py-1 pr-2">
                <div className="font-medium">{line.name}</div>
                <div className="font-mono text-[10px] text-[var(--hc-muted)]">
                  {line.sku}
                  {line.finishId ? ` · ${line.finishId}` : ''}
                </div>
              </td>
              <td className="py-1 pr-1 text-right tabular-nums text-[var(--hc-muted)]">
                {line.quantity}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatEur(line.lineTotalEur)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 space-y-0.5 border-t border-[var(--hc-border)] pt-2 text-[11px]">
        <div className="flex justify-between text-[var(--hc-muted)]">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatEur(bom.subtotalEur ?? 0)}</span>
        </div>
        <div className="flex justify-between text-[var(--hc-muted)]">
          <span>VAT (incl.)</span>
          <span className="tabular-nums">{formatEur(bom.vatEur ?? 0)}</span>
        </div>
        <div className="flex justify-between font-semibold text-[var(--hc-text)]">
          <span>Total</span>
          <span className="tabular-nums">{formatEur(bom.totalEur ?? 0)}</span>
        </div>
      </div>
    </section>
  );
}
