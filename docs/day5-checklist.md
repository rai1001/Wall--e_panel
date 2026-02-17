# Day 5 Checklist - Panel usable para operacion diaria

## Objetivo
- [x] Convertir `/v1/dashboard` en panel modular usable (no solo metricas tecnicas)

## UI/UX Dashboard
- [x] Navegacion por modulos: `Dashboard`, `Projects`, `Automations`, `Chat Timeline`
- [x] Mantener metricas + memoria dentro del modulo Dashboard
- [x] Estados claros de `loading`, `error`, `empty/no data`
- [x] Compatibilidad auth por header o cookie (`oc_token`)

## Endpoints panel-ready
- [x] Projects: list + create + update status (`GET/POST /v1/projects`, `PATCH /v1/projects/:id`)
- [x] Automations: list + create + enable/disable (`PATCH /v1/automation/rules/:id/status`)
- [x] Chat Timeline: endpoint de eventos/mensajes recientes (`GET /v1/chat/timeline`)

## Data y migraciones
- [x] Migraciones idempotentes mantenidas
- [x] Hardening `project_id` para esquemas legacy (`conversations`, `memory_items`)
- [x] Test de migracion legacy agregado

## Config y docs
- [x] `.env.example` alineado con Google embeddings
- [x] `README.md` actualizado con panel Day 5
- [x] `docs/runbook.md` actualizado
- [x] `docs/troubleshooting.md` actualizado (incluye Unauthorized vs Empty vs No data)
- [x] `docs/day3-migration.md` actualizado con hardening Day 5
- [x] `docs/adr-day5.md` agregado

## Calidad
- [x] `npm run typecheck` OK
- [x] `npm test` OK
- [x] `npm run smoke` OK
- [x] `npm run reindex` OK
