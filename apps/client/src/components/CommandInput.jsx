import { useState } from 'react';

/**
 * @param {{
 *   onSubmit: (command: string, inputChannel?: 'text' | 'voice') => void,
 *   disabled?: boolean
 * }} props
 */
export function CommandInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');

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
        Command
      </label>
      <div className="flex items-center gap-1.5 rounded-[12px] border border-[var(--hc-border)] bg-black/50 p-1">
        <input
          id="command"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="add a 600 mm cabinet"
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-[var(--hc-text)] outline-none placeholder:text-[var(--hc-muted)]/70 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          className="hc-btn-accent shrink-0 rounded-[10px] px-3.5 py-2 text-xs font-semibold"
        >
          Send
        </button>
      </div>
    </form>
  );
}
