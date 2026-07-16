import { useCallback, useEffect, useState } from 'react';
import { getHealth, postCommand } from './api/client.js';
import { CommandInput } from './components/CommandInput.jsx';
import { ResultViewer } from './components/ResultViewer.jsx';

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function App() {
  const [sessionId] = useState(() => newId('sess'));
  const [projectId] = useState(() => newId('proj'));
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  const sendCommand = useCallback(
    async (command) => {
      setLoading(true);
      setError(null);
      try {
        const result = await postCommand({
          requestId: newId('req'),
          sessionId,
          projectId,
          inputMode: 'dialog',
          command,
          clientState: {}
        });
        setResponse(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [projectId, sessionId]
  );

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-stone-100 px-6 py-8 font-normal text-stone-900">
      <header className="mb-6">
        <h1 className="mb-1 font-medium text-3xl text-stone-900">HomeCraft</h1>
        <p className="text-stone-600">
          Step 0 — skeleton monorepo (dialog → API → pipeline stub)
        </p>
      </header>
      <CommandInput onSubmit={sendCommand} disabled={loading} />
      <ResultViewer response={response} error={error} health={health} />
    </main>
  );
}
