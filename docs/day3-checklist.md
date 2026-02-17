# Day 3 Checklist - Cierre

## Estado general
- [x] Completado sobre base `822bd04`
- [x] Compatible con rutas legacy (deprecadas) y rutas versionadas `/v1`

## 1) Memoria vectorizada real
- [x] Embeddings persistentes (`memory_embeddings`)
- [x] Búsqueda híbrida (semantic + lexical + prioridad por proyecto/agente/scope)
- [x] Filtros por `project_id`, `agent_id`, `scope`, `memoryType`, rango fecha
- [x] Endpoint de reindex incremental (`POST /v1/memory/reindex`)

## 2) Endpoints panel-ready
- [x] Métricas de memoria (`GET /v1/ops/memory/metrics`)
- [x] Salud de automatización (`GET /v1/ops/automation/health`)
- [x] Auditoría agregada (`GET /v1/ops/audit/aggregated`)
- [x] Vista panel de memorias + acciones (`GET /v1/memory/panel`, promote/forget/block)

## 3) Data hygiene
- [x] Deduplicación (`POST /v1/memory/deduplicate`)
- [x] TTL y archivado de temporales (`POST /v1/memory/hygiene/run`)
- [x] Limpieza de `processed_events` antiguos (`POST /v1/memory/hygiene/run`)

## 4) Seguridad extra
- [x] Rate limit en `auth/login`
- [x] Rotación simple JWT por env (`JWT_SECRETS`, compat con múltiples claves)
- [x] Validación fuerte con Zod en endpoints críticos

## 5) DX + operaciones
- [x] Backup SQLite (`npm run backup`)
- [x] Restore SQLite (`npm run restore -- --file=...`)
- [x] Reindex memoria (`npm run reindex`)
- [x] Reset seguro local (`FORCE_RESET=true npm run reset:local`)
- [x] Runbook operativo (`docs/runbook.md`)
