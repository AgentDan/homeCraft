const API_BASE = '/api';

/**
 * @param {number} status
 * @param {object} body
 * @returns {Error & {
 *   status: number,
 *   body: object,
 *   code?: string
 * }}
 */
export function createApiError(status, body) {
  const message =
    typeof body?.message === 'string'
      ? body.message
      : `API ${status}: ${JSON.stringify(body)}`;
  const error = /** @type {Error & {
 *   status: number,
 *   body: object,
 *   code?: string
 * }} */ (new Error(message));
  error.name = 'ApiError';
  error.status = status;
  error.body = body;
  if (typeof body?.code === 'string') {
    error.code = body.code;
  }
  return error;
}

/**
 * @param {unknown} error
 * @returns {error is Error & { status: number, body: object, code?: string }}
 */
export function isApiError(error) {
  return error instanceof Error && error.name === 'ApiError';
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
    throw createApiError(response.status, data);
  }

  return data;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
