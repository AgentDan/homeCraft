/**
 * Detects user intent from English natural language with no silent fallback.
 *
 * @param {string} text - User command
 */
export async function detectIntent(text) {
  const { matchIntent } = await import('@homecraft/ai');
  return matchIntent(text);
}
