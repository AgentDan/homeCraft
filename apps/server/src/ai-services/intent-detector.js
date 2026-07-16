/**
 * Detects user intent from natural language. RU-first, no silent fallback.
 *
 * @param text - User command
 * @param lang - Optional language hint
 */
export async function detectIntent(text, lang) {
  const { matchIntent } = await import('@homecraft/ai');
  const result = matchIntent(text);
  if (lang && result.kind !== 'unknown') {
    return { ...result, language: lang };
  }
  return result;
}
