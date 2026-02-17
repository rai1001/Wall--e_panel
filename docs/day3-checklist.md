# Day 3 Checklist - Cierre

## Estado general
- [x] Completado sobre base `822bd04`
- [x] Compatible con rutas legacy (deprecadas) y rutas versionadas `/v1`

## 1) Memoria vectorizada real
- [x] Embeddings persistentes (`memory_embeddings`)
- [x] Busqueda hibrida (semantic + lexical + prioridad por proyecto/agente/scope)
- [x] Filtros por `project_id`, `agent_id`, `scope`, `memoryType`, rango fecha
- [x] Endpoint de reindex incremental (`POST /v1/memory/reindex`)

## 2) Endpoints panel-ready
- [x] Metricas de memoria (`GET /v1/ops/memory/metrics`)
- [x] Salud de automatizacion (`GET /v1/ops/automation/health`)
- [x] Auditoria agregada (`GET /v1/ops/audit/aggregated`)
- [x] Vista panel de memorias + acciones (`GET /v1/memory/panel`, promote/forget/block)

## 3) Data hygiene
- [x] Deduplicacion (`POST /v1/memory/deduplicate`)
- [x] TTL y archivado de temporales (`POST /v1/memory/hygiene/run`)
- [x] Limpieza de `processed_events` antiguos (`POST /v1/memory/hygiene/run`)

## 4) Seguridad extra
- [x] Rate limit en `auth/login`
- [x] Rotacion simple JWT por env (`JWT_SECRETS`, compat con multiples claves)
- [x] Validacion fuerte con Zod en endpoints criticos

## 5) DX + operaciones
- [x] Backup SQLite (`npm run backup`)
- [x] Restore SQLite (`npm run restore -- --file=...`)
- [x] Reindex memoria (`npm run reindex`)
- [x] Reset seguro local (`npm run reset:local`)
- [x] Runbook operativo (`docs/runbook.md`)

## 6) Cuadre docs <-> package.json
- [x] Scripts operativos declarados en `package.json`
- [x] Comandos de docs alineados con scripts reales
