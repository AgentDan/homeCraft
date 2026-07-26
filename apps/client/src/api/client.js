const API_BASE = '/api';

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {object} body
   */
  constructor(status, body) {
    super(
      typeof body?.message === 'string'
        ? body.message
        : `API ${status}: ${JSON.stringify(body)}`
    );
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = typeof body?.code === 'string' ? body.code : undefined;
  }
}

export async function postCommand(payload) {
  const request = {
    inputChannel: 'text',
    ...structuredClone(payload)
  };
  const response = await fetch(`${API_BASE}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
