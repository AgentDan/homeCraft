/**
 * Detects user intent from natural language (EN/RU/SR) with no silent fallback.
 *
 * @param {string} text - User command
 * @param {'en' | 'ru' | 'sr'} [language]
 */
export async function detectIntent(text, language) {
  const { matchIntent } = await import('@homecraft/ai');
  return matchIntent(text, { language });
}
