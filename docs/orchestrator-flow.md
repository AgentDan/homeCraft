# Orchestrator flow

Source of truth: `apps/server/src/core/orchestrator.js` + `ai-services/pipeline.js`.

Open this file in any Mermaid preview (VS Code / Cursor Mermaid extension, GitHub, [mermaid.live](https://mermaid.live)).

```mermaid
flowchart TD
  START(["POST /api/commands"]) --> PARSE["parseClientRequest"]
  PARSE --> ROUTE["route(request)"]

  ROUTE --> REC["recordCommandRequest"]
  REC --> CTX["buildRoomContext"]
  CTX --> CAT{"catalogSnapshotId?"}
  CAT -->|yes| CTX2["context.catalogSnapshotId = …"]
  CAT -->|no| TURN
  CTX2 --> TURN["appendDialogTurn user"]
  TURN --> PERSIST1["persistRoomContext"]
  PERSIST1 --> AI

  subgraph AI["AI services · runAiPipeline"]
    direction TB
    DI["detectIntent"]
    RET["retrieve + retrievePlatformRules"]
    PR["buildPrompt"]
    GP["generatePlan"]
    DI --> RET --> PR --> GP
    GP --> AIOUT["{ intent, plan, outcome }"]
  end

  AI --> ROOM{"slots roomWidth/Depth?"}
  ROOM -->|yes| UPDROOM["update context.roomShape"]
  ROOM -->|no| BR
  UPDROOM --> BR

  BR{"intent / outcome"}
  BR -->|undo / redo| HIST["handleHistoryIntent"]
  HIST -->|no entry| CLAR1["buildClarifyResponse"]
  HIST -->|entry| DOWN1["runDownstream<br/>existingVersion = entry.version"]
  BR -->|help| HELP["buildHelpResponse"]
  BR -->|unknown| UNK["buildUnknownIntentResponse"]
  BR -->|outcome.clarify| CLAR2["buildClarifyResponse"]
  BR -->|set_budget без суммы| CLAR3["buildClarifyResponse"]
  BR -->|set_budget ok| BUD["context.budgetEur = …"]
  BR -->|add/remove/finish/show_price/…| PREP
  BUD --> PREP

  PREP["messages · readOnly · newOperations · changeSummary"]
  PREP --> DOWN2["runDownstream"]

  subgraph DOWN["runDownstream"]
    direction TB
    COMP["assertCompatible"]
    SCENE["kitchen pipeline → scene"]
    BOM["calculateBOM"]
    VER{"persistVersion && no existingVersion && valid?"}
    SAVE["appendPlanVersion"]
    OUT["buildOutput → ClientResponse"]
    COMP --> SCENE --> BOM --> VER
    VER -->|yes| SAVE --> OUT
    VER -->|no| OUT
  end

  DOWN1 --> DOWN
  DOWN2 --> DOWN
  CLAR1 --> FIN
  CLAR2 --> FIN
  CLAR3 --> FIN
  HELP --> FIN
  UNK --> FIN
  DOWN --> FIN

  FIN["finalizeResponse"]
  FIN --> UPD["если plan valid: обновить planOperations / planVersion"]
  UPD --> TURN2["appendDialogTurn assistant"]
  TURN2 --> PERSIST2["persistRoomContext"]
  PERSIST2 --> RETAPI["return { response: ClientResponse, statusCode: 200 }"]
  RETAPI --> HTTP["sendJson → клиент"]
```
