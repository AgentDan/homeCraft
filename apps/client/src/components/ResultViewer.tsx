import type { ClientResponse } from '@homecraft/contracts';

type Props = {
  response: ClientResponse | null;
  error: string | null;
  health: Record<string, unknown> | null;
};

export function ResultViewer({ response, error, health }: Props) {
  return (
    <section className="result-viewer">
      <h2>Ответ сервера</h2>
      {error && <pre className="panel error">{error}</pre>}
      {response && (
        <pre className="panel">{JSON.stringify(response, null, 2)}</pre>
      )}
      <h3>Health</h3>
      <pre className="panel muted">{JSON.stringify(health, null, 2)}</pre>
    </section>
  );
}
