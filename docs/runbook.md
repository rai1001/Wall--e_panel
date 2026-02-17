# Runbook Operativo (v1)

## 1) Arranque y checks

```bash
npm install
npm run typecheck
npm test
npm run smoke
```

## 2) Backup / restore

Backup:

```bash
npm run backup
```

Restore:

```bash
npm run restore -- --file=backups/assistant-YYYY-MM-DDTHH-MM-SS.db
```

## 3) Reindex de memoria vectorial

Completo (límite default):

```bash
npm run reindex
```

Incremental:

```bash
npm run reindex -- --since=2026-02-17T00:00:00.000Z --limit=2000
```

## 4) Higiene de datos

Ejecutar TTL + dedup + cleanup:

```bash
curl -X POST http://localhost:3000/v1/memory/hygiene/run \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"processedEventsMaxAgeDays":30}'
```

## 5) Operación panel

Dashboard:

```text
GET /v1/dashboard
```

Funciones:
- filtros por proyecto/agente/fecha/scope/tipo
- promover a global
- olvidar
- bloquear
- revisión de aprobaciones y runs

## 6) Reset local seguro

```bash
FORCE_RESET=true npm run reset:local
```

## 7) Indicadores clave a vigilar
- `GET /v1/ops/memory/metrics`
- `GET /v1/ops/automation/health`
- `GET /v1/ops/audit/aggregated`
