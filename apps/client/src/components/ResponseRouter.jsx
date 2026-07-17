import { lazy, Suspense, useState } from 'react';
import { ResultViewer } from './ResultViewer.jsx';

const ScenePreview = lazy(() =>
  import('./ScenePreview.jsx').then((module) => ({
    default: module.ScenePreview
  }))
);

function ChangeSummary({ summary }) {
  if (!summary) return null;

  const groups = [
    ['Добавлено', summary.added],
    ['Удалено', summary.removed],
    ['Перемещено', summary.moved]
  ].filter(([, items]) => items?.length);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="mb-2 font-medium text-stone-900">Изменения</h3>
      <p className="text-stone-700">{summary.text}</p>
      {groups.map(([label, items]) => (
        <p key={label} className="mt-1 text-sm text-stone-600">
          {label}: {items.join(', ')}
        </p>
      ))}
    </section>
  );
}

function ClarifyForm({ response, onCommand, disabled }) {
  const [value, setValue] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const command = value.trim();
    if (!command) return;
    onCommand(command);
    setValue('');
  }

  return (
    <form className="rounded-lg border border-amber-300 bg-amber-50 p-4" onSubmit={handleSubmit}>
      <label htmlFor="clarify-command" className="mb-2 block font-medium text-stone-900">
        {response.interaction?.prompt ?? response.message}
      </label>
      <div className="flex gap-2">
        <input
          id="clarify-command"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          Ответить
        </button>
      </div>
    </form>
  );
}

function TextResponse({ response }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-stone-800">{response.message}</p>
      {response.interaction?.prompt && response.interaction.prompt !== response.message && (
        <p className="mt-2 text-sm text-stone-600">{response.interaction.prompt}</p>
      )}
    </section>
  );
}

export function ResponseRouter({ response, onCommand, disabled }) {
  if (!response) return null;

  switch (response.responseType) {
    case 'scene':
      return (
        <section className="space-y-4">
          <TextResponse response={response} />
          <Suspense
            fallback={
              <div className="h-96 animate-pulse rounded-lg bg-stone-200" />
            }
          >
            <ScenePreview sceneResult={response.sceneResult} view={response.view} />
          </Suspense>
          <ChangeSummary summary={response.changeSummary} />
        </section>
      );
    case 'clarify':
      return <ClarifyForm response={response} onCommand={onCommand} disabled={disabled} />;
    case 'options':
      return (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-3 text-stone-800">
            {response.interaction?.prompt ?? response.message}
          </p>
          <div className="flex flex-wrap gap-2">
            {(response.interaction?.options ?? []).map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onCommand(option.label)}
                className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      );
    case 'confirm':
      return (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="mb-3 text-stone-800">
            {response.interaction?.prompt ?? response.message}
          </p>
          <div className="flex gap-2">
            {['Да', 'Нет'].map((label) => (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => onCommand(label)}
                className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      );
    case 'conflict':
    case 'help':
    case 'unknown_intent':
      return <TextResponse response={response} />;
    default:
      return <ResultViewer response={response} error={null} health={null} />;
  }
}
