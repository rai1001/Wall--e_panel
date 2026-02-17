# Runbook Operativo (v1)

## 0) Script parity (docs <-> package.json)

Los siguientes scripts estan declarados en `package.json` y son los oficiales:
- `npm run backup`
- `npm run restore -- --file=<backup.db>`
- `npm run reindex`
- `npm run reset:local`

Config flags relevant for operations:
- `EMBEDDING_PROVIDER=local|openai`
- `RATE_LIMIT_STORE=db|memory` (`db` recommended for shared limits)

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

Completo (limite default):

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

## 5) Operacion panel

Dashboard:

```text
GET /v1/dashboard
```

Funciones:
- filtros por proyecto/agente/fecha/scope/tipo
- promover a global
- olvidar
- bloquear
- revision de aprobaciones y runs

## 6) Reset local seguro

Bash:

```bash
FORCE_RESET=true npm run reset:local
```

PowerShell:

```powershell
$env:FORCE_RESET='true'; npm run reset:local
```

## 7) Indicadores clave a vigilar
- `GET /v1/ops/memory/metrics`
- `GET /v1/ops/automation/health`
- `GET /v1/ops/audit/aggregated`

## 8) Troubleshooting

Ver `docs/troubleshooting.md` para errores comunes de DB, puerto, JWT y filesystem.
