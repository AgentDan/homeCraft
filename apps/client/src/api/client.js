const API_BASE = '/api';

export async function postCommand(payload) {
  const response = await fetch(`${API_BASE}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
