import { createValidCompatibilityReport } from '@homecraft/contracts';

/**
 * Compatibility firewall — ONLY stage that may reject a plan (invariant #2).
 * Step0: always valid; rules in phase 2.
 */
export async function assertCompatible(_plan, _context) {
  return createValidCompatibilityReport();
}
