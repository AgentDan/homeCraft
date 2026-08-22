import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigurationPlanSchema, registry } from '@homecraft/contracts';
import { deskManifest } from '@homecraft/manifests/desk';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import {
  loadPolicy,
  parsePolicyYaml,
  PolicySchema,
  resetPolicyCacheForTests
} from './load-policy.js';
import { scoreCandidates, selectByConfidence } from './score-candidates.js';
import { decideCandidates } from './decide-candidates.js';

const SNAPSHOT = 'kitchen-demo-v1';

// planWith() runs while describe() bodies are collected (before hooks), so
// kitchen must be registered at load time — a before() hook is too late here.
if (!registry.registeredTypes().includes('kitchen')) {
  registry.register(kitchenManifest);
}

function planWith(operations) {
  return ConfigurationPlanSchema.parse({
    planId: 'p-policy',
    projectId: 'proj-1',
    catalogSnapshotId: SNAPSHOT,
    operations,
    createdAt: new Date().toISOString()
  });
}

function candidate(sku, totalEur, instanceId = 'module-1') {
  return {
    label: `Replace ${instanceId} with ${sku}`,
    plan: planWith([
      { type: 'add_module', sku: 'BASE-800', position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
      { type: 'add_module', sku: 'BASE-400', position: { x: 700, y: 0, z: 0 }, rotationY: 0 },
      { type: 'replace_module', instanceId, sku }
    ]),
    bom: { totalEur },
    replacedInstanceId: instanceId,
    replacedWithSku: sku
  };
}

describe('policy loader', () => {
  beforeEach(() => {
    resetPolicyCacheForTests();
  });

  it('parses and normalizes default policy.yaml weights', async () => {
    const policy = await loadPolicy({ reload: true });
    assert.equal(policy.version, '1');
    const sum =
      policy.weights.price + policy.weights.ergonomics + policy.weights.style;
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.equal(policy.minGapToSecond, 0.08);
  });

  it('rejects weights that sum to zero', () => {
    assert.throws(() =>
      PolicySchema.parse(
        parsePolicyYaml(`version: "1"
weights:
  price: 0
  ergonomics: 0
  style: 0
minGapToSecond: 0.1
`)
      )
    );
  });
});

describe('policy scoring + confidence', () => {
  const rejectedPlan = planWith([
    { type: 'add_module', sku: 'BASE-800', position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    { type: 'add_module', sku: 'BASE-400', position: { x: 700, y: 0, z: 0 }, rotationY: 0 }
  ]);

  const candidates = [
    candidate('BASE-400', 100),
    candidate('BASE-600', 150)
  ];

  it('price-heavy policy prefers the cheaper candidate', async () => {
    const ranked = await scoreCandidates(
      candidates,
      {
        weights: { price: 1, ergonomics: 0, style: 0 },
        minGapToSecond: 0.08
      },
      { catalogSnapshotId: SNAPSHOT, rejectedPlan }
    );
    assert.equal(ranked[0].candidate.replacedWithSku, 'BASE-400');
    assert.ok(ranked[0].score > ranked[1].score);
  });

  it('ergonomics-heavy policy prefers the wider candidate without code changes', async () => {
    const ranked = await scoreCandidates(
      candidates,
      {
        weights: { price: 0, ergonomics: 1, style: 0 },
        minGapToSecond: 0.08
      },
      { catalogSnapshotId: SNAPSHOT, rejectedPlan }
    );
    assert.equal(ranked[0].candidate.replacedWithSku, 'BASE-600');
  });

  it('style-heavy policy prefers the width closer to the original module', async () => {
    const ranked = await scoreCandidates(
      candidates,
      {
        weights: { price: 0, ergonomics: 0, style: 1 },
        minGapToSecond: 0.08
      },
      { catalogSnapshotId: SNAPSHOT, rejectedPlan }
    );
    // Original is BASE-800 (800mm); BASE-600 is closer than BASE-400.
    assert.equal(ranked[0].candidate.replacedWithSku, 'BASE-600');
  });

  it('auto-applies when the gap clears the threshold', () => {
    const selection = selectByConfidence(
      [
        { candidate: candidates[0], score: 0.9, breakdown: { price: 1, ergonomics: 0, style: 0 } },
        { candidate: candidates[1], score: 0.5, breakdown: { price: 0, ergonomics: 1, style: 0 } }
      ],
      { minGapToSecond: 0.08 }
    );
    assert.equal(selection.decision, 'auto_apply');
    assert.equal(selection.winner?.candidate.replacedWithSku, 'BASE-400');
  });

  it('asks the user on a near-tie', () => {
    const selection = selectByConfidence(
      [
        { candidate: candidates[0], score: 0.52, breakdown: { price: 1, ergonomics: 0, style: 0 } },
        { candidate: candidates[1], score: 0.5, breakdown: { price: 0, ergonomics: 1, style: 0 } }
      ],
      { minGapToSecond: 0.08 }
    );
    assert.equal(selection.decision, 'ask_user');
    assert.equal(selection.winner, null);
    assert.ok(selection.gap < 0.08);
  });

  it('decideCandidates loads policy.yaml and returns a ranked decision', async () => {
    const decision = await decideCandidates(candidates, {
      catalogSnapshotId: SNAPSHOT,
      rejectedPlan
    });
    assert.ok(decision.ranked.length === 2);
    assert.ok(
      decision.decision === 'auto_apply' || decision.decision === 'ask_user'
    );
    if (decision.decision === 'auto_apply') {
      assert.ok(decision.winner);
    }
  });
});

describe('policy.yaml override path', () => {
  beforeEach(() => {
    resetPolicyCacheForTests();
  });

  it('honours an explicit policy path for a near-tie config', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'homecraft-policy-'));
    const policyPath = path.join(dir, 'policy.yaml');
    await writeFile(
      policyPath,
      `version: "test-tie"
weights:
  price: 0.5
  ergonomics: 0.5
  style: 0
minGapToSecond: 0.99
`
    );
    try {
      const policy = await loadPolicy({ path: policyPath, reload: true });
      assert.equal(policy.version, 'test-tie');
      assert.equal(policy.minGapToSecond, 0.99);

      const rejectedPlan = planWith([
        { type: 'add_module', sku: 'BASE-800', position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
        { type: 'add_module', sku: 'BASE-400', position: { x: 700, y: 0, z: 0 }, rotationY: 0 }
      ]);
      const decision = await decideCandidates(
        [candidate('BASE-400', 100), candidate('BASE-600', 150)],
        { catalogSnapshotId: SNAPSHOT, rejectedPlan },
        { policy }
      );
      assert.equal(decision.decision, 'ask_user');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('desk domain policy', () => {
  beforeEach(() => {
    resetPolicyCacheForTests();
  });

  it('loads desk weights from manifest policyPath', async () => {
    const deskPolicy = await loadPolicy({
      path: deskManifest.policyPath,
      reload: true
    });
    assert.ok(Math.abs(deskPolicy.weights.price - 0.6) < 1e-9);
    assert.ok(Math.abs(deskPolicy.weights.ergonomics - 0.15) < 1e-9);
    assert.ok(Math.abs(deskPolicy.weights.style - 0.25) < 1e-9);
  });

  it('ranks desk candidates differently from kitchen default policy', async () => {
    const rejectedPlan = planWith([
      { type: 'add_module', sku: 'BASE-800', position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
      { type: 'add_module', sku: 'BASE-400', position: { x: 700, y: 0, z: 0 }, rotationY: 0 }
    ]);
    const candidates = [
      candidate('BASE-400', 100),
      candidate('BASE-600', 150)
    ];
    const context = { catalogSnapshotId: SNAPSHOT, rejectedPlan };

    const kitchenPolicy = await loadPolicy({ reload: true });
    const deskPolicy = await loadPolicy({
      path: deskManifest.policyPath,
      reload: true
    });

    const kitchenDecision = await decideCandidates(candidates, context, {
      policy: kitchenPolicy
    });
    const deskDecision = await decideCandidates(candidates, context, {
      policy: deskPolicy
    });

    assert.equal(
      kitchenDecision.ranked[0].candidate.replacedWithSku,
      'BASE-400'
    );
    assert.equal(
      deskDecision.ranked[0].candidate.replacedWithSku,
      'BASE-400'
    );
    assert.notEqual(
      kitchenDecision.ranked[0].score,
      deskDecision.ranked[0].score
    );
    assert.equal(kitchenDecision.decision, 'ask_user');
    assert.equal(kitchenDecision.gap, 0);
    assert.equal(deskDecision.decision, 'auto_apply');
    assert.ok(deskDecision.gap >= deskPolicy.minGapToSecond);
  });
});
