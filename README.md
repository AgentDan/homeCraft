# HomeCraft

AI-платформа для диалоговой сборки мебельных проектов из каталога производителя. Архитектурный каркас — как [AIproject](https://github.com/AgentDan/AIproject): orchestrator, RAG, детерминированные domain modules.

## Быстрый старт

```bash
cp .env.example .env
npm install
npm run dev
```

- API: http://localhost:3001
- Client: http://localhost:5173
- Health: http://localhost:3001/api/health

Опционально (MongoDB + Redis):

```bash
docker compose up -d
```

## Пайплайн (10 стадий)

```
POST /api/commands
  → orchestrator.route()           # MODE A dialog | MODE B editor → один ConfigurationPlan
    → room-context-builder
      → ai-services/pipeline
        → intent-detector          [AI]
        → catalog-rag-retriever    [AI]
        → configuration-plan-generator
      → assertCompatible()         [единственный rejector]
      → domain-modules/kitchen/runPipeline()
      → calculateBOM()
    → output-builder → ClientResponse
```

## Монорепозиторий

```
apps/client   — React 19 + Vite
apps/server   — Express + TypeScript
apps/mobile   — stub (phase 6)
packages/contracts, packages/ai, packages/catalog-schema
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Server + client |
| `npm run typecheck` | TS check all workspaces |
| `npm run lint` | ESLint |
| `npm run test` | Smoke tests |
| `npm run catalog:index` | RAG index (step0 stub) |
| `npm run build` | Production client build |

## Step 0 status

Skeleton with typed Zod contracts, wired pipeline stubs, working `POST /api/commands`. Business logic — phase 1+.

See [docs/Roadmap.md](docs/Roadmap.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
