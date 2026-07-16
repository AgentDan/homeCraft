import type { CompatibilityReport, ConfigurationPlan, RoomContext } from '@homecraft/contracts';
import { createValidCompatibilityReport } from '@homecraft/contracts';

/**
 * Compatibility firewall — ONLY stage that may reject a plan (invariant #2).
 * Step0: always valid; rules in phase 2.
 */
export async function assertCompatible(
  _plan: ConfigurationPlan,
  _context: RoomContext
): Promise<CompatibilityReport> {
  return createValidCompatibilityReport();
}
