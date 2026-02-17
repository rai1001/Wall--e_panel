# OpenClaw Assistant Panel - v1

Asistente modular con 5 dominios:
- `chat`
- `project`
- `memory`
- `automation`
- `policy`

Flujo E2E base:

`Crear tarea en Proyecto -> dispara Automatizacion -> genera mensaje en Chat -> guarda Memoria`

## Stack
- Node.js + TypeScript
- Express
- SQLite (`better-sqlite3`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- Zod (validación)
- Vitest + Supertest

## Quick Start

```bash
npm install
npm run dev
```

Credenciales seed:
- `admin@local / admin123`
- `manager@local / manager123`
- `member@local / member123`
- `viewer@local / viewer123`

## Validación de calidad

```bash
npm run typecheck
npm test
npm run smoke
```

CI local:

```bash
npm run ci
```

## API versioning

- Recomendado: `/v1/*`
- Compat legacy: rutas antiguas aún existen con headers de deprecación.
- Detalle de migración: `docs/day3-migration.md`

## Memoria compartida persistente

### Namespace de memoria
Cada memoria soporta:
- `projectId`
- `agentId`
- `scope` (`global`, `proyecto`, `privado`)
- `memoryType`
- `source`
- `createdBy`
- `timestamp`
- `tags`

### Búsqueda híbrida
- Vectorial (embeddings persistentes en SQLite)
- Lexical
- Prioridad contextual:
  - proyecto activo
  - scope global
  - agente actual

Endpoint principal:
- `GET /v1/memory/search`

### Data hygiene
- deduplicación
- TTL y archivado de temporales
- limpieza de `processed_events`

Endpoints:
- `POST /v1/memory/reindex`
- `POST /v1/memory/deduplicate`
- `POST /v1/memory/hygiene/run`

### Acciones panel
- `POST /v1/memory/:id/promote-global`
- `POST /v1/memory/:id/forget`
- `POST /v1/memory/:id/block`

## Operación diaria

### 1) Respaldo
```bash
npm run backup
```

### 2) Reindex de memoria
```bash
npm run reindex
```

### 3) Restore
```bash
npm run restore -- --file=backups/assistant-YYYY-MM-DDTHH-MM-SS.db
```

### 4) Reset local seguro
```bash
FORCE_RESET=true npm run reset:local
```

### 5) Panel operativo
- `GET /v1/dashboard`

Dashboard incluye:
- métricas de requests/automation/memory
- aprobaciones pendientes
- run logs
- vista de memorias con filtros y acciones

Runbook completo:
- `docs/runbook.md`

## Seguridad
- JWT con rotación simple (`JWT_SECRETS` con múltiples secretos)
- Rate limit global + rate limit específico en login
- Lockout progresivo por intentos fallidos
- Validación fuerte de payloads con Zod
- Auditoría persistente

## Observabilidad
Endpoints:
- `GET /v1/ops/metrics`
- `GET /v1/ops/memory/metrics`
- `GET /v1/ops/automation/health`
- `GET /v1/ops/audit/aggregated`

## Documentación técnica
- `docs/adr-day1.md`
- `docs/adr-day2.md`
- `docs/adr-day3.md`
- `docs/day2-checklist.md`
- `docs/day3-checklist.md`
- `docs/openapi.yaml`
- `docs/day3-migration.md`
