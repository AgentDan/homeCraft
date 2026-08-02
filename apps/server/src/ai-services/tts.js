import { runtimeConfig } from '../config/runtime.js';

/**
 * @param {unknown} value
 */
function isTruthy(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on'
  );
}

/**
 * OpenAI-compatible TTS is available when an API key (or custom TTS URL) is set.
 * Enabled by default when LLM key exists; disable with HOMECRAFT_TTS=0.
 */
export function ttsConfigured() {
  const flag = process.env.HOMECRAFT_TTS;
  if (flag !== undefined && flag !== '' && !isTruthy(flag)) {
    return false;
  }
  if (runtimeConfig.llmApiKey) return true;
  return Boolean(process.env.HOMECRAFT_TTS_API_URL?.trim());
}

/**
 * @returns {string}
 */
export function ttsApiUrl() {
  const explicit = process.env.HOMECRAFT_TTS_API_URL?.trim();
  if (explicit) return explicit;
  // Derive from chat completions URL when possible.
  const chatUrl = runtimeConfig.llmApiUrl;
  if (chatUrl.includes('/chat/completions')) {
    return chatUrl.replace(/\/chat\/completions\/?$/, '/audio/speech');
  }
  return 'https://api.openai.com/v1/audio/speech';
}

/**
 * @param {string} language
 * @returns {string}
 */
export function ttsVoiceForLanguage(language) {
  const override = process.env.HOMECRAFT_TTS_VOICE?.trim();
  if (override) return override;
  if (language === 'ru') return 'nova';
  if (language === 'sr') return 'shimmer';
  return 'alloy';
}

/**
 * Synthesize speech audio (mp3 buffer) via OpenAI-compatible TTS.
 * @param {{ text: string, language?: string }} input
 * @returns {Promise<Buffer>}
 */
export async function synthesizeSpeech(input) {
  const text = String(input.text ?? '').trim().slice(0, 4000);
  if (!text) {
    throw Object.assign(new Error('TTS text is empty.'), { statusCode: 400 });
  }
  if (!ttsConfigured()) {
    throw Object.assign(new Error('AI TTS is not configured.'), { statusCode: 503 });
  }

  const language = input.language === 'ru' || input.language === 'sr'
    ? input.language
    : 'en';
  const model = process.env.HOMECRAFT_TTS_MODEL?.trim() || 'tts-1';
  const voice = ttsVoiceForLanguage(language);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.HOMECRAFT_TTS_TIMEOUT_MS ?? 20000)
  );

  try {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    if (runtimeConfig.llmApiKey) {
      headers.Authorization = `Bearer ${runtimeConfig.llmApiKey}`;
    }

    const response = await fetch(ttsApiUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: 'mp3'
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw Object.assign(
        new Error(`TTS provider error ${response.status}: ${detail.slice(0, 200)}`),
        { statusCode: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}
