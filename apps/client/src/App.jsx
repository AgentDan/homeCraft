import { useCallback, useEffect, useState } from 'react';
import { getHealth, postCommand } from './api/client.js';
import { CommandInput } from './components/CommandInput.jsx';
import { ResponseRouter } from './components/ResponseRouter.jsx';
import { ResultViewer } from './components/ResultViewer.jsx';

/** @param {string} prefix */
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function App() {
  const [sessionId] = useState(() => newId('sess'));
  const [projectId] = useState(() => newId('proj'));
  const [response, setResponse] = useState(
    /** @type {{ requestId: string, [key: string]: unknown } | null} */ (null)
  );
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [health, setHealth] = useState(/** @type {unknown} */ (null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  const sendCommand = useCallback(
    /**
     * @param {string} command
     * @param {'text' | 'voice'} [inputChannel]
     */
    async (command, inputChannel = 'text') => {
      setLoading(true);
      setError(null);
      try {
        const result = await postCommand({
          requestId: newId('req'),
          sessionId,
          projectId,
          inputChannel,
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
          Step 0 — диалог текстом или голосом → API → pipeline stub
        </p>
      </header>
      <CommandInput onSubmit={sendCommand} disabled={loading} />
      <div className="mb-6">
        <ResponseRouter
          key={response?.requestId}
          response={response}
          onCommand={sendCommand}
          disabled={loading}
        />
      </div>
      <ResultViewer response={null} error={error} health={health} />
    </main>
  );
}
