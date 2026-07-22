/**
 * Detects user intent from natural language (EN/RU) with no silent fallback.
 *
 * @param {string} text - User command
 * @param {'en' | 'ru'} [language]
 */
export async function detectIntent(text, language) {
  const { matchIntent } = await import('@homecraft/ai');
  return matchIntent(text, { language });
}
