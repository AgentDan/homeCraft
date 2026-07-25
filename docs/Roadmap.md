# HomeCraft — Roadmap

Phases 0–3 ✅. Pilot MVP = Step 4. Order: `1→2→3→4`, `5→6→7`, `8` parallel, `9` after 1, `10` after 7+8.

## Todo

- [ ] **1. Command journal** — append-only JSONL in `data/action-history/`
- [ ] **2. Idempotency + optimistic locking** — `expectedVersion` → 409; dedupe `requestId`
- [ ] **3. Replay test in CI** — `replayJournal` == snapshot
- [ ] **4. Production Export** — PDF bound to version + catalog snapshot
- [ ] **5. Branches** — history as tree (`create_branch` / `switch_branch`)
- [ ] **6. Candidates on conflict** — 2–3 priced options instead of hard reject
- [ ] **7. Policy + confidence** — `policy.yaml` weights; ask on near-tie
- [ ] **8. LLM parser (flag)** — intent JSON + Zod; fallback to rules
- [ ] **9. Voice input** — STT V1–V5 ([voice-stt-plan.md](voice-stt-plan.md))
- [ ] **10. Explanation + TTS** — grounded numbers; V6–V7

## Deferred

- [ ] Analog ranking polish (2.8)
- [ ] Wardrobe domain / Expo / auth / multi-tenant / customer memory
