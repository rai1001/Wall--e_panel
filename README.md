# OpenClaw Assistant Panel - v1 (Day 5)

Modular assistant with 5 domains:
- `chat`
- `project`
- `memory`
- `automation`
- `policy`

Core E2E flow:

`Create task in Project -> trigger Automation -> post Chat message -> save Memory`

## Stack
- Node.js + TypeScript
- Express
- SQLite (`better-sqlite3`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- Zod (request validation)
- Vitest + Supertest

## Day 5 result
`/v1/dashboard` now provides a usable panel with module navigation:
- `Dashboard`: metrics, approvals/runs, memory panel and actions
- `Projects`: list/create projects and update status
- `Automations`: list/create rules and enable/disable
- `Chat Timeline`: recent chat events with filters

Auth behavior remains compatible:
- `Authorization: Bearer ...`
- or cookie session from `/login` (`oc_token`)

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Login entry:
- `http://localhost:3000/login`

Seed credentials:
- `admin@local / admin123`
- `manager@local / manager123`
- `member@local / member123`
- `viewer@local / viewer123`

## Environment

Minimum env:
- `PORT`
- `DB_PATH`
- `JWT_SECRET` or `JWT_SECRETS`
- `EMBEDDING_PROVIDER`
- `RATE_LIMIT_STORE`

Embedding provider in real usage:
- `EMBEDDING_PROVIDER=google`
- `GOOGLE_API_KEY=...`
- optional `GOOGLE_EMBEDDING_MODEL=text-embedding-004`

If provider/model changes:
```bash
npm run reindex
```

## API versioning
- Recommended: `/v1/*`
- Legacy routes remain mounted with deprecation headers
- Migration details: `docs/day3-migration.md`

## Panel endpoints (Day 5)

Projects:
- `GET /v1/projects`
- `POST /v1/projects`
- `PATCH /v1/projects/:id`

Automations:
- `GET /v1/automation/rules`
- `POST /v1/automation/rules`
- `PATCH /v1/automation/rules/:id/status`

Chat Timeline:
- `GET /v1/chat/timeline`

Ops and memory (existing):
- `GET /v1/ops/metrics`
- `GET /v1/ops/memory/metrics`
- `GET /v1/ops/automation/health`
- `GET /v1/ops/audit/aggregated`
- `POST /v1/memory/reindex`
- `POST /v1/memory/deduplicate`
- `POST /v1/memory/hygiene/run`

## Shared persistent memory

Namespace fields:
- `projectId`
- `agentId`
- `scope` (`global`, `proyecto`, `privado`)
- `memoryType`
- `source`
- `createdBy`
- `timestamp`
- `tags`

Hybrid retrieval:
- semantic embeddings (Google in production, local fallback)
- lexical score
- context priority (project/global/agent)

Main search endpoint:
- `GET /v1/memory/search`

## Daily operations

Backup:
```bash
npm run backup
```

Restore:
```bash
npm run restore -- --file=backups/assistant-YYYY-MM-DDTHH-MM-SS.db
```

Reindex:
```bash
npm run reindex
```

Safe local reset:
```bash
FORCE_RESET=true npm run reset:local
```

PowerShell:
```powershell
$env:FORCE_RESET='true'; npm run reset:local
```

## Dashboard diagnosis

- `Unauthorized`: usually expired/missing token or cookie. Re-login at `/login`.
- `Empty`: module rendered but no data returned for selected filters.
- `No data`: backend healthy but there are no records yet (expected on clean DB).

Detailed troubleshooting:
- `docs/troubleshooting.md`

## Security
- JWT rotation via `JWT_SECRETS`
- Distributed rate limit (DB-backed)
- Login throttling + temporary lockout
- Zod validation on critical payloads
- Audit records for sensitive actions

## Quality gates

```bash
npm run typecheck
npm test
npm run smoke
npm run reindex
```

## Technical docs
- `docs/adr-day1.md`
- `docs/adr-day2.md`
- `docs/adr-day3.md`
- `docs/adr-day4.md`
- `docs/adr-day5.md`
- `docs/day2-checklist.md`
- `docs/day3-checklist.md`
- `docs/day4-checklist.md`
- `docs/day5-checklist.md`
- `docs/day3-migration.md`
- `docs/runbook.md`
- `docs/troubleshooting.md`
- `docs/openapi.yaml`
