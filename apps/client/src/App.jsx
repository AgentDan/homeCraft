import { useCallback, useEffect, useState } from 'react';
import { getHealth, postCommand } from './api/client.js';
import { CommandInput } from './components/CommandInput.jsx';
import { ResponseRouter } from './components/ResponseRouter.jsx';
import { ResultViewer } from './components/ResultViewer.jsx';

/** @param {string} prefix */
function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function DialogHistory({ turns }) {
  if (turns.length === 0) return null;
  return (
    <section className="mb-4 space-y-2" aria-label="История диалога">
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={
            turn.role === 'user'
              ? 'ml-auto max-w-2xl rounded-lg bg-emerald-800 px-4 py-3 text-white'
              : 'mr-auto max-w-2xl rounded-lg border border-stone-200 bg-white px-4 py-3 text-stone-800'
          }
        >
          {turn.text}
        </div>
      ))}
    </section>
  );
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
  const [turns, setTurns] = useState(
    /** @type {Array<{id: string, role: 'user' | 'assistant', text: string}>} */ ([])
  );

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
      setResponse(null);
      setTurns((current) => [
        ...current,
        { id: newId('turn'), role: 'user', text: command }
      ]);
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
        setTurns((current) => [
          ...current,
          { id: newId('turn'), role: 'assistant', text: result.message }
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [projectId, sessionId]
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-stone-100 px-6 py-8 font-normal text-stone-900">
      <header className="mb-6">
        <h1 className="mb-1 font-medium text-3xl text-stone-900">HomeCraft</h1>
        <p className="text-stone-600">
          MVP — соберите кухню в диалоге и посмотрите результат в 3D
        </p>
      </header>
      <DialogHistory turns={response ? turns.slice(0, -1) : turns} />
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
