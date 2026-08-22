import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Implicit kitchen default for loadPolicy() callers that omit `path`
// (decide-candidates, policy tests). The file lives with the kitchen
// manifest; desk (and kitchen via run-downstream) pass manifest.policyPath.
const DEFAULT_POLICY_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/manifests/kitchen/policy.yaml'
);

export const PolicySchema = z
  .object({
    version: z.union([z.string().min(1), z.number()]).transform(String),
    weights: z.object({
      price: z.number().nonnegative(),
      ergonomics: z.number().nonnegative(),
      style: z.number().nonnegative()
    }),
    minGapToSecond: z.number().nonnegative()
  })
  .superRefine((policy, ctx) => {
    const sum =
      policy.weights.price + policy.weights.ergonomics + policy.weights.style;
    if (sum <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'policy weights must sum to a positive value'
      });
    }
  })
  .transform((policy) => {
    const sum =
      policy.weights.price + policy.weights.ergonomics + policy.weights.style;
    return {
      version: policy.version,
      weights: {
        price: policy.weights.price / sum,
        ergonomics: policy.weights.ergonomics / sum,
        style: policy.weights.style / sum
      },
      minGapToSecond: policy.minGapToSecond
    };
  });

/**
 * Minimal YAML subset parser for this policy file shape:
 * top-level keys, one nested `weights` map, scalar string/number values.
 * @param {string} text
 * @returns {unknown}
 */
export function parsePolicyYaml(text) {
  /** @type {Record<string, unknown>} */
  const root = {};
  /** @type {Record<string, unknown> | null} */
  let nested = null;
  /** @type {string | null} */
  let nestedKey = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '');
    if (!line.trim()) continue;

    const nestedMatch = line.match(/^[ \t]+([A-Za-z_][\w]*)\s*:\s*(.*)$/);
    if (nestedMatch && nested) {
      nested[nestedMatch[1]] = coerceScalar(nestedMatch[2].trim());
      continue;
    }

    const topMatch = line.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
    if (!topMatch) {
      throw new Error(`Unsupported policy.yaml line: ${rawLine}`);
    }
    const key = topMatch[1];
    const value = topMatch[2].trim();
    if (value === '') {
      nested = {};
      nestedKey = key;
      root[key] = nested;
      continue;
    }
    nested = null;
    nestedKey = null;
    root[key] = coerceScalar(value);
  }

  if (nestedKey && nested && Object.keys(nested).length === 0) {
    throw new Error(`Empty mapping for "${nestedKey}" in policy.yaml`);
  }
  return root;
}

/**
 * @param {string} value
 * @returns {string | number}
 */
function coerceScalar(value) {
  const quoted = value.match(/^(["'])(.*)\1$/);
  if (quoted) {
    return quoted[2];
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

/** @type {ReturnType<typeof PolicySchema.parse> | null} */
let cachedPolicy = null;
/** @type {string | null} */
let cachedPath = null;

/**
 * Loads and validates policy.yaml (cached per path).
 * Override path with HOMECRAFT_POLICY_PATH for tests.
 * @param {{ path?: string, reload?: boolean }} [options]
 */
export async function loadPolicy(options = {}) {
  const policyPath = options.path ?? process.env.HOMECRAFT_POLICY_PATH ?? DEFAULT_POLICY_PATH;
  if (!options.reload && cachedPolicy && cachedPath === policyPath) {
    return cachedPolicy;
  }
  const text = await readFile(policyPath, 'utf8');
  const policy = PolicySchema.parse(parsePolicyYaml(text));
  cachedPolicy = policy;
  cachedPath = policyPath;
  return policy;
}

/** @internal */
export function resetPolicyCacheForTests() {
  cachedPolicy = null;
  cachedPath = null;
}
