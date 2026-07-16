import { useState, type FormEvent } from 'react';

type Props = {
  onSubmit: (command: string) => void;
  disabled?: boolean;
};

export function CommandInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <form className="command-form" onSubmit={handleSubmit}>
      <label htmlFor="command">Команда (MODE A — диалог)</label>
      <textarea
        id="command"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Например: что ты умеешь?"
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        Отправить
      </button>
    </form>
  );
}
