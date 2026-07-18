/**
 * Detects user intent from English natural language with no silent fallback.
 *
 * @param text - User command
 * @param [lang] - Optional language hint
 */
export async function detectIntent(text, lang) {
  const { matchIntent } = await import('@homecraft/ai');
  const detected = matchIntent(text);
  const slots = { ...(detected.slots ?? {}) };

  if (detected.kind === 'set_budget' && slots.budgetEur === undefined) {
    const budgetMatch = text.match(/\bbudget(?:\s+(?:up\s+to|of))?\s+([\d,\s]{3,})/i);
    if (budgetMatch) {
      slots.budgetEur = Number(budgetMatch[1].replace(/[,\s]/g, ''));
    }
  }

  if (detected.kind === 'add_module' && /\bkitchen\b/i.test(text)) {
    slots.layout = 'starter_kitchen';
  }

  const result = Object.keys(slots).length > 0
    ? { ...detected, slots }
    : detected;
  if (lang && result.kind !== 'unknown') {
    return { ...result, language: lang };
  }
  return result;
}
