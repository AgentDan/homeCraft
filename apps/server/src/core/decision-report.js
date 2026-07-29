import { normalizeLanguage, t } from '../i18n/messages.js';

/**
 * @typedef {{
 *   intentKind?: string,
 *   message?: string,
 *   numbers: {
 *     totalEur?: number | null,
 *     subtotalEur?: number | null,
 *     lineCount?: number | null,
 *     budgetEur?: number | null,
 *     budgetOverEur?: number | null,
 *     policyScore?: number | null,
 *     policyGap?: number | null
 *   },
 *   compatibilityValid?: boolean | null,
 *   conflictCount?: number,
 *   policy?: {
 *     decision: 'auto_apply' | 'ask_user' | 'none',
 *     winnerSku?: string,
 *     policyVersion?: string
 *   } | null
 * }} DecisionReport
 */

/**
 * Builds a deterministic decision report with grounded numbers only.
 *
 * @param {{
 *   intentKind?: string,
 *   message?: string,
 *   bom?: { totalEur?: number, subtotalEur?: number, lines?: unknown[] } | null,
 *   budgetEur?: number | null,
 *   compatibility?: { valid?: boolean, conflicts?: unknown[] } | null,
 *   policy?: {
 *     decision: 'auto_apply' | 'ask_user' | 'none',
 *     winnerSku?: string,
 *     score?: number,
 *     gap?: number,
 *     policyVersion?: string
 *   } | null
 * }} input
 * @returns {DecisionReport}
 */
export function buildDecisionReport(input) {
  const totalEur = input.bom?.totalEur ?? null;
  const budgetEur = input.budgetEur ?? null;
  const budgetOverEur =
    totalEur != null && budgetEur != null && totalEur > budgetEur
      ? totalEur - budgetEur
      : null;

  return {
    intentKind: input.intentKind,
    message: input.message,
    numbers: {
      totalEur,
      subtotalEur: input.bom?.subtotalEur ?? null,
      lineCount: input.bom?.lines?.length ?? null,
      budgetEur,
      budgetOverEur,
      policyScore: input.policy?.score ?? null,
      policyGap: input.policy?.gap ?? null
    },
    compatibilityValid:
      input.compatibility == null ? null : Boolean(input.compatibility.valid),
    conflictCount: input.compatibility?.conflicts?.length ?? 0,
    policy: input.policy
      ? {
          decision: input.policy.decision,
          winnerSku: input.policy.winnerSku,
          policyVersion: input.policy.policyVersion
        }
      : null
  };
}

/**
 * @param {DecisionReport} report
 * @returns {Set<string>}
 */
function reportNumberTokens(report) {
  /** @type {Set<string>} */
  const tokens = new Set();
  for (const value of Object.values(report.numbers)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      tokens.add(String(value));
      tokens.add(String(Math.round(value)));
    }
  }
  tokens.add(String(report.conflictCount ?? 0));
  for (const text of [
    report.intentKind,
    report.policy?.policyVersion,
    report.policy?.winnerSku,
    report.message
  ]) {
    if (!text) continue;
    for (const match of text.match(/\d+/g) ?? []) {
      tokens.add(match);
    }
  }
  return tokens;
}

/**
 * Every number-like token in `text` must appear in the report (anti-hallucination).
 * @param {string} text
 * @param {DecisionReport} report
 */
export function isExplanationGrounded(text, report) {
  const allowed = reportNumberTokens(report);
  const matches = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches.every((token) => {
    const normalized = token.replace(',', '.');
    return (
      allowed.has(token)
      || allowed.has(normalized)
      || allowed.has(String(Number(normalized)))
    );
  });
}

/**
 * Deterministic explanation from a decision report (no LLM).
 * @param {DecisionReport} report
 * @param {unknown} language
 */
export function explainFromReport(report, language) {
  const lang = normalizeLanguage(language);
  const parts = [];

  if (report.intentKind) {
    parts.push(t(lang, 'explainIntent', { kind: report.intentKind }));
  }

  if (report.policy?.decision === 'auto_apply' && report.policy.winnerSku) {
    parts.push(
      t(lang, 'explainPolicyApplied', {
        sku: report.policy.winnerSku,
        score: report.numbers.policyScore ?? 0,
        gap: report.numbers.policyGap ?? 0,
        policyVersion: report.policy.policyVersion ?? ''
      })
    );
  } else if (report.policy?.decision === 'ask_user') {
    parts.push(
      t(lang, 'explainPolicyNearTie', {
        gap: report.numbers.policyGap ?? 0,
        policyVersion: report.policy.policyVersion ?? ''
      })
    );
  }

  if (report.compatibilityValid === false) {
    parts.push(
      t(lang, 'explainConflict', { count: report.conflictCount ?? 0 })
    );
  }

  if (report.numbers.lineCount != null && report.numbers.totalEur != null) {
    parts.push(
      t(lang, 'explainBom', {
        lineCount: report.numbers.lineCount,
        subtotalEur: report.numbers.subtotalEur ?? 0,
        totalEur: report.numbers.totalEur
      })
    );
  }

  if (report.numbers.budgetOverEur != null) {
    parts.push(
      t(lang, 'budgetExceeded', { over: report.numbers.budgetOverEur })
    );
  }

  const explanation = parts.filter(Boolean).join(' ').trim();
  if (!explanation) {
    return report.message || t(lang, 'commandProcessed');
  }
  if (!isExplanationGrounded(explanation, report)) {
    return report.message || t(lang, 'commandProcessed');
  }
  return explanation;
}
