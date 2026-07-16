import { useCallback, useEffect, useState } from 'react';
import type { ClientResponse } from '@homecraft/contracts';
import { getHealth, postCommand } from './api/client';
import { CommandInput } from './components/CommandInput';
import { ResultViewer } from './components/ResultViewer';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function App() {
  const [sessionId] = useState(() => newId('sess'));
  const [projectId] = useState(() => newId('proj'));
  const [response, setResponse] = useState<ClientResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  const sendCommand = useCallback(
    async (command: string) => {
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
    <main className="app">
      <header>
        <h1>HomeCraft</h1>
        <p className="subtitle">Step 0 — skeleton monorepo (dialog → API → pipeline stub)</p>
      </header>
      <CommandInput onSubmit={sendCommand} disabled={loading} />
      <ResultViewer response={response} error={error} health={health} />
    </main>
  );
}
