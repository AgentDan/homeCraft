import { useState } from 'react';

function CompactPrompt({ children }) {
  return (
    <section className="hc-glass hc-glass--compact px-3 py-2.5">
      {children}
    </section>
  );
}

function ClarifyForm({ response, onCommand, disabled, compact }) {
  const [value, setValue] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const command = value.trim();
    if (!command) return;
    onCommand(command);
    setValue('');
  }

  return (
    <form
      className={`hc-glass border-[rgba(255,193,7,0.28)] ${compact ? 'hc-glass--compact px-3 py-2.5' : 'p-4'}`}
      onSubmit={handleSubmit}
    >
      <label
        htmlFor="clarify-command"
        className={`mb-1.5 block text-[var(--hc-text)] ${compact ? 'text-xs leading-snug' : 'mb-2 text-sm font-medium'}`}
      >
        {response.interaction?.prompt ?? response.message}
      </label>
      <div className="flex gap-1.5">
        <input
          id="clarify-command"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-[10px] border border-[var(--hc-border)] bg-black/45 px-2.5 py-1.5 text-sm text-[var(--hc-text)] outline-none"
        />
        <button
          type="submit"
          disabled={disabled}
          className="hc-btn-accent rounded-[10px] px-3 py-1.5 text-xs font-semibold"
        >
          Reply
        </button>
      </div>
    </form>
  );
}

/**
 * @param {{
 *   response: { responseType?: string, message?: string, interaction?: any, changeSummary?: any } | null,
 *   onCommand: (command: string) => void,
 *   disabled?: boolean,
 *   compact?: boolean
 * }} props
 */
export function ResponseRouter({ response, onCommand, disabled, compact = false }) {
  if (!response) return null;

  // In compact HUD, scene/status text lives in Health — only keep interactive prompts.
  if (compact) {
    switch (response.responseType) {
      case 'clarify':
        return (
          <ClarifyForm
            response={response}
            onCommand={onCommand}
            disabled={disabled}
            compact
          />
        );
      case 'options':
        return (
          <CompactPrompt>
            <p className="mb-2 text-xs leading-snug text-[var(--hc-muted)]">
              {response.interaction?.prompt ?? response.message}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(response.interaction?.options ?? []).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCommand(option.label)}
                  className="hc-btn-accent rounded-[10px] px-3 py-1.5 text-xs"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CompactPrompt>
        );
      case 'confirm':
        return (
          <CompactPrompt>
            <p className="mb-2 text-xs leading-snug text-[var(--hc-muted)]">
              {response.interaction?.prompt ?? response.message}
            </p>
            <div className="flex gap-1.5">
              {['Yes', 'No'].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCommand(label)}
                  className="hc-btn-accent rounded-[10px] px-3 py-1.5 text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </CompactPrompt>
        );
      default:
        return null;
    }
  }

  return null;
}
