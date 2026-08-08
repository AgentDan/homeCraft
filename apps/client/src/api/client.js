const API_BASE = '/api';

/**
 * @param {number} status
 * @param {{ message?: string, code?: string, currentVersion?: number, [key: string]: unknown }} body
 * @returns {Error & {
 *   status: number,
 *   body: { message?: string, code?: string, currentVersion?: number, [key: string]: unknown },
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
 *   body: { message?: string, code?: string, currentVersion?: number, [key: string]: unknown },
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
 * @returns {error is Error & {
 *   status: number,
 *   body: { message?: string, code?: string, currentVersion?: number, [key: string]: unknown },
 *   code?: string
 * }}
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

/**
 * @param {{
 *   clientId: string,
 *   eventType: 'click' | 'hover_long' | 'reject_variant' | 'compare',
 *   targetId: string,
 *   durationMs: number
 * }} signal
 */
export async function postBehaviorSignal(signal) {
  const response = await fetch(`${API_BASE}/observation/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signal)
  });
  const data = await response.json();
  if (!response.ok) {
    throw createApiError(response.status, data);
  }
  return data;
}

async function adminFetch(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw createApiError(response.status, data);
  }
  return data;
}

export function getAdminSchemaCatalog() {
  return adminFetch('/admin/schema-catalog');
}

export function getAdminJourneyQuestions() {
  return adminFetch('/admin/journey-questions');
}

/**
 * @param {unknown[]} questions
 */
export function putAdminJourneyQuestions(questions) {
  return adminFetch('/admin/journey-questions', {
    method: 'PUT',
    body: JSON.stringify({ questions })
  });
}

export function getAdminRecommendationRules() {
  return adminFetch('/admin/recommendation-rules');
}

/**
 * @param {unknown[]} rules
 */
export function putAdminRecommendationRules(rules) {
  return adminFetch('/admin/recommendation-rules', {
    method: 'PUT',
    body: JSON.stringify({ rules })
  });
}

/**
 * @param {number} [attempts]
 * @param {number} [delayMs]
 */
export async function getHealth(attempts = 8, delayMs = 400) {
  /** @type {unknown} */
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) {
        throw createApiError(response.status, {
          message: `Health check failed with ${response.status}`
        });
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Health check failed');
}
