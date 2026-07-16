# HomeCraft

AI-платформа для диалоговой сборки мебельных проектов из каталога производителя.

Архитектурный каркас — как [AIproject](https://github.com/AgentDan/AIproject): orchestrator, RAG, детерминированные domain modules. Домен мебели: Compatibility Engine, Pricing, BOM, production export.

**Текущий статус:** фаза 0 завершена — skeleton, Zod-контракты, рабочий API, production deploy. Бизнес-логика — фаза 1+.

Диалоговый вход MODE A принимает текст или расшифровку голоса через единый `command`; `inputChannel` только отмечает источник (`text`/`voice`). Каждый ответ объединяет каналы Say/Show/Ask: текст и короткую реплику для TTS, описание 2D/3D-представления и ожидаемое продолжение диалога. Версии плана поддерживают команды undo/redo, а визуализация сцены пока остаётся явной заглушкой step0.

---

## Стек

| Слой | Технология |
|------|------------|
| Язык | JavaScript (ESM), без TypeScript |
| API | Node.js 20 + Express 5 + Zod |
| Client | React 19 + Vite + Tailwind CSS v4 |
| БД | MongoDB (lazy connect) |
| Файлы | `apps/server/data/` — как AIproject |
| Monorepo | npm workspaces |

---

## Быстрый старт (development)

```bash
cp .env.example .env
npm install
npm run dev
```

| Сервис | URL |
|--------|-----|
| API | http://localhost:3001 |
| Client (Vite) | http://localhost:5173 |
| Health | http://localhost:3001/api/health |

Dev-режим: API и клиент раздельно (Vite proxy → `/api`).

---

## Production deploy (как AIproject)

```bash
cp .env.example .env
# В .env: NODE_ENV=production, CORS_ORIGIN=https://your-domain.com

npm install
npm run build:deploy
npm start
```

Один процесс на `HOST:PORT` (по умолчанию `0.0.0.0:3001`):

- **API** — `/api/*`
- **SPA** — статика из `apps/client/dist` (fallback на `index.html`)
- **GLTF** — `/gltf` из `apps/server/gltf`
- **Сессии** — `apps/server/data/` или `SERVER_STORAGE_DIR`

---

## Переменные окружения

Файл **`.env` в корне монорепо** (шаблон — `.env.example`):

```bash
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/homecraft

# SERVER_STORAGE_DIR=       # по умолчанию apps/server/data
# CORS_ORIGIN=              # production
# CLIENT_DIST_PATH=         # по умолчанию apps/client/dist
```

Загрузка: `apps/server/src/config/load-env.js`.

---

## Пайплайн

```
POST /api/commands
  → orchestrator.route()              # MODE A dialog | MODE B editor
    → room-context-builder
      → ai-services/pipeline
        → intent-detector             [AI]
        → catalog-rag-retriever       [AI, stub]
        → configuration-plan-generator
      → assertCompatible()            [единственный rejector, stub]
      → domain-modules/kitchen/runPipeline()
      → calculateBOM()
    → output-builder → ClientResponse
```

---

## Структура монорепо

```
apps/
  client/          React + Vite + Tailwind (CommandInput, ResultViewer)
  server/          Express API, orchestrator, engines, storage
  mobile/          stub (фаза 6)
packages/
  contracts/       Zod-схемы (ClientRequest, ConfigurationPlan, BOM, …)
  ai/              IntentRegistry RU/EN, llm-client stub
  catalog-schema/  Zod-схема каталога производителя
docs/
  Roadmap.md       план фаз
  step0.md         итоги фазы 0
```

---

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Server (nodemon) + client (Vite) |
| `npm run dev:server` | Только API |
| `npm run dev:client` | Только клиент |
| `npm run build` | Сборка client → `apps/client/dist` |
| `npm run build:deploy` | То же — для деплоя |
| `npm start` | Production server |
| `npm run test` | Smoke tests (все workspaces) |
| `npm run lint` | ESLint |
| `npm run catalog:index` | RAG index (stub) |

---

## API (step0)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Краткий health |
| GET | `/api/health` | Health + storage + MongoDB |
| GET | `/api` | Список endpoints |
| GET | `/api/storage/status` | Статус local storage |
| POST | `/api/commands` | Основной пайплайн |

---

## Документация

- [docs/Roadmap.md](docs/Roadmap.md) — фазы 1–6
- [docs/step0.md](docs/step0.md) — что сделано в фазе 0
- [CONTRIBUTING.md](CONTRIBUTING.md) — инварианты и code review
- [docs/dommaster-presentation-and-cursor-prompt.md](docs/dommaster-presentation-and-cursor-prompt.md) — презентации и промпты
