export function ResultViewer({ response, error, health }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="mb-2 font-medium text-stone-900">Ответ сервера</h2>
        {error && (
          <pre className="overflow-auto rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </pre>
        )}
        {response && (
          <pre className="overflow-auto rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-800">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </div>
      <div>
        <h3 className="mb-2 font-medium text-stone-900">Health</h3>
        <pre className="overflow-auto rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
          {JSON.stringify(health, null, 2)}
        </pre>
      </div>
    </section>
  );
}
