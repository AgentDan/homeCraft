import { useState } from 'react';

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
    <form className="mb-6 flex flex-col gap-2" onSubmit={handleSubmit}>
      <label htmlFor="command" className="font-medium text-stone-800">
        Команда (MODE A — диалог)
      </label>
      <textarea
        id="command"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Например: help"
        disabled={disabled}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-normal text-stone-900 outline-none focus:border-emerald-700"
      />
      <button
        type="submit"
        disabled={disabled}
        className="self-start rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Отправить
      </button>
    </form>
  );
}
