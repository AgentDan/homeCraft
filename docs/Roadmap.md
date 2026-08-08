# HomeCraft Roadmap

**Invariant:** AI → intent + speech only. Compatibility / BOM only via `assertCompatible()` + `calculateBOM()`.  
**Do not rewrite** `dialog-router.js` (intro→brief→survey→done, guided|free). Extend beside it.  
No `discovery` / `edit_profile` / `build` / `history` / `meta` phases.

| Phase | Goal | Done when |
|---|---|---|
| **Ф0** Observation | `DialogTurn` + `BehaviorSignal` + `Outcome` (contracts); one timeline `clientId`+`ts`+`seq` with journey events; 4 configurator signals on client | ✅ Sorted merge via `GET /api/observation/:clientId/timeline` |
| **Ф1** Typed questions | `JourneyQuestionSchema` + `validateAnswer`; migrate 4 slots; +5 (`hasKidsOrPets`…); `dependsOn` skip; Mongo `journey_questions` | Old 4 identical; `facadeMaterialPreference` skipped if kids/pets = no |
| **Ф2** DecisionState v0 | Recalc DS from Observation (no ML); `post_survey` outside router when `stage===done`; minimal `ClientProfile` | `phase=post_survey` after done; `dialog-router.test.js` unchanged |
| **Ф3** DP4 rules → MVP | `recommendation-engine` → plan generator → assert → BOM; speech vs config separate; 3 mandatory rules | E2E: survey → DP4 → check → variant+speech → `Outcome` |
| **Ф4** Admin UI | Dropdown-only constructors for questions + rules | Cannot type arbitrary fields |
| **Ф5** Utility model | Gate: enough held-out `clientOutcome` | Do not start earlier |

**Never:** sentiment from text; Learning/DP4 reading past sessions (use `ClientProfile`); LLM choosing variant; new top-level dirs under `apps/server/src/` (put modules in `core/`).

Each phase = own branch/PR + one `CHANGELOG.md` line.
