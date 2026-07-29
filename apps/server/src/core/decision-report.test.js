import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDecisionReport,
  explainFromReport,
  isExplanationGrounded
} from './decision-report.js';

describe('decision-report', () => {
  it('builds grounded numbers including budget overage', () => {
    const report = buildDecisionReport({
      intentKind: 'add_module',
      bom: { totalEur: 1200, subtotalEur: 1000, lines: [{}, {}] },
      budgetEur: 1000,
      compatibility: { valid: true, conflicts: [] }
    });
    assert.equal(report.numbers.totalEur, 1200);
    assert.equal(report.numbers.budgetOverEur, 200);
    assert.equal(report.numbers.lineCount, 2);
  });

  it('explainFromReport stays grounded and mentions budget exceedance', () => {
    const report = buildDecisionReport({
      intentKind: 'set_budget',
      bom: { totalEur: 1500, subtotalEur: 1250, lines: [{}] },
      budgetEur: 1000
    });
    const explanation = explainFromReport(report, 'en');
    assert.match(explanation, /exceeds the budget/);
    assert.match(explanation, /Handled as set_budget/);
    assert.equal(isExplanationGrounded(explanation, report), true);
  });

  it('rejects explanations with hallucinated numbers', () => {
    const report = buildDecisionReport({
      intentKind: 'help',
      bom: { totalEur: 100, subtotalEur: 80, lines: [{}] }
    });
    assert.equal(isExplanationGrounded('Total is €99999', report), false);
    assert.equal(isExplanationGrounded('Total is €100', report), true);
  });

  it('includes policy auto-apply and conflict lines when present', () => {
    const report = buildDecisionReport({
      intentKind: 'add_module',
      bom: { totalEur: 500, subtotalEur: 420, lines: [{}, {}] },
      compatibility: { valid: false, conflicts: [{}, {}] },
      policy: {
        decision: 'auto_apply',
        winnerSku: 'BASE-400',
        score: 0.82,
        gap: 0.15,
        policyVersion: '1.0'
      }
    });
    const explanation = explainFromReport(report, 'en');
    assert.match(explanation, /BASE-400/);
    assert.match(explanation, /2 conflict/);
    assert.equal(isExplanationGrounded(explanation, report), true);
  });
});
