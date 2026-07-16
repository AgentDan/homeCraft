import type { ClientRequest, ClientResponse } from '@homecraft/contracts';

const API_BASE = '/api';

export async function postCommand(payload: ClientRequest): Promise<ClientResponse> {
  const response = await fetch(`${API_BASE}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as ClientResponse;
}

export async function getHealth(): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/health`);
  return (await response.json()) as Record<string, unknown>;
}
