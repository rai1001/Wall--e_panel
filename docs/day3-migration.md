# Day 3 Migration Notes

## Compatibilidad de API

Se mantiene compatibilidad razonable:
- Las rutas legacy siguen disponibles (`/auth`, `/projects`, etc.) con headers:
  - `Deprecation: true`
  - `Sunset: Wed, 30 Sep 2026 00:00:00 GMT`
- Las rutas recomendadas son bajo `/v1/*`.

## Cambios principales

1. **Versionado**
- Nuevo prefijo operativo: `/v1`.

2. **Memoria**
- `POST /v1/memory/save` ahora soporta campos adicionales:
  - `projectId`, `agentId`, `scope`, `memoryType`, `createdBy`, `ttlSeconds`, `temporary`.
- Nuevos endpoints:
  - `GET /v1/memory/panel`
  - `POST /v1/memory/reindex`
  - `POST /v1/memory/deduplicate`
  - `POST /v1/memory/hygiene/run`
  - `POST /v1/memory/:id/promote-global`
  - `POST /v1/memory/:id/forget`
  - `POST /v1/memory/:id/block`

3. **Ops**
- Nuevos endpoints:
  - `GET /v1/ops/memory/metrics`
  - `GET /v1/ops/automation/health`
  - `GET /v1/ops/audit/aggregated`

4. **Auth/JWT**
- Soporte de rotación simple con `JWT_SECRETS=secret_nuevo,secret_anterior`.
- Si no se define, se usa `JWT_SECRET`.

## Variables de entorno nuevas/relevantes
- `JWT_SECRETS` (opcional): lista separada por coma.
- `JWT_SECRET` (fallback).
- `DB_PATH` (opcional).
- `FORCE_RESET=true` para reset local explícito.

## Recomendación de adopción
1. Migrar clientes internos a `/v1/*`.
2. Validar flujos de memoria usando nuevos filtros y acciones de panel.
3. Programar uso regular de `backup` y `reindex`.
