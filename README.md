# OpenClaw Assistant Panel - v1

Modular assistant with 5 domains:
- `chat`
- `project`
- `memory`
- `automation`
- `policy`

Base E2E flow:

`Create task in Project -> trigger Automation -> post Chat message -> save Memory`

## Stack
- Node.js + TypeScript
- Express
- SQLite (`better-sqlite3`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- Zod (request validation)
- Vitest + Supertest

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Seed credentials:
- `admin@local / admin123`
- `manager@local / manager123`
- `member@local / member123`
- `viewer@local / viewer123`

## Quality checks

```bash
npm run typecheck
npm test
npm run smoke
```

CI local:

```bash
npm run ci
```

## Environment

See `.env.example` for minimum config:
- `PORT`
- `DB_PATH`
- `JWT_SECRET` or `JWT_SECRETS`
- `EMBEDDING_PROVIDER` (`local` or `openai`)
- `RATE_LIMIT_STORE` (`db` recommended)
- optional flags

## API versioning

- Recommended: `/v1/*`
- Legacy compatibility: old routes still mounted with deprecation headers.
- Migration details: `docs/day3-migration.md`

## Shared persistent memory

### Namespace fields
Each memory supports:
- `projectId`
- `agentId`
- `scope` (`global`, `proyecto`, `privado`)
- `memoryType`
- `source`
- `createdBy`
- `timestamp`
- `tags`

### Hybrid retrieval
- Semantic embeddings (local `semantic-hash-v2` or optional OpenAI) stored in SQLite (`memory_embeddings`)
- Lexical score
- Context priority:
  - active project
  - global scope
  - current agent

Main endpoint:
- `GET /v1/memory/search`

### Data hygiene
- deduplication
- TTL and archive for temporary memory
- cleanup of old `processed_events`

Endpoints:
- `POST /v1/memory/reindex`
- `POST /v1/memory/deduplicate`
- `POST /v1/memory/hygiene/run`

### Panel actions
- `POST /v1/memory/:id/promote-global`
- `POST /v1/memory/:id/forget`
- `POST /v1/memory/:id/block`

## Daily operation

### 1) Backup
```bash
npm run backup
```

### 2) Reindex memory
```bash
npm run reindex
```

### 3) Restore
```bash
npm run restore -- --file=backups/assistant-YYYY-MM-DDTHH-MM-SS.db
```

### 4) Safe local reset
Bash:
```bash
FORCE_RESET=true npm run reset:local
```
PowerShell:
```powershell
$env:FORCE_RESET='true'; npm run reset:local
```

### 5) Operations panel
- `GET /v1/dashboard`

Dashboard includes:
- request/automation/memory metrics
- pending approvals
- run logs
- memory list with filters and actions

Runbook:
- `docs/runbook.md`

## Security
- JWT with simple rotation (`JWT_SECRETS`)
- Distributed rate limit (SQLite-backed shared counters) + dedicated login rate limit
- Progressive lockout after failed login attempts
- Strong payload validation with Zod
- Persistent audit records

## Observability
- `GET /v1/ops/metrics`
- `GET /v1/ops/memory/metrics`
- `GET /v1/ops/automation/health`
- `GET /v1/ops/audit/aggregated`

## Troubleshooting
- `docs/troubleshooting.md`

## Known issues (2026-02-17)

Current status:
- Day 4 hardening applied and operational for daily use.

Pending fixes:
- Add cost/latency guardrails dashboard for OpenAI embedding mode (quota, fallback ratio, timeout stats).

## Technical docs
- `docs/adr-day1.md`
- `docs/adr-day2.md`
- `docs/adr-day3.md`
- `docs/adr-day4.md`
- `docs/day2-checklist.md`
- `docs/day3-checklist.md`
- `docs/day4-checklist.md`
- `docs/openapi.yaml`
- `docs/day3-migration.md`
- `docs/runbook.md`
- `docs/troubleshooting.md`
