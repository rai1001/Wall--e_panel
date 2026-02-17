# Runbook Operativo (v1 - Day 5)

## 0) Scripts oficiales (docs <-> package.json)

Scripts disponibles y validados:
- `npm run backup`
- `npm run restore -- --file=<backup.db>`
- `npm run reindex`
- `npm run reset:local`

## 1) Arranque y validacion base

```bash
npm install
npm run typecheck
npm test
npm run smoke
npm run dev
```

## 2) Configuracion recomendada de embeddings

Produccion:
- `EMBEDDING_PROVIDER=google`
- `GOOGLE_API_KEY=<secret>`
- opcional `GOOGLE_EMBEDDING_MODEL=text-embedding-004`

Fallback local (incidencia/quota):
- `EMBEDDING_PROVIDER=local`

Si cambias provider o model, ejecutar:
```bash
npm run reindex
```

## 3) Operacion del panel web

Entrada:
- `GET /login`

Flujo:
1. Login en `/login`
2. Se crea cookie `oc_token`
3. Redirect a `/v1/dashboard`

Modulos operativos en panel:
- Dashboard
- Projects
- Automations
- Chat Timeline

## 4) Backups y recovery

Backup:
```bash
npm run backup
```

Restore:
```bash
npm run restore -- --file=backups/assistant-YYYY-MM-DDTHH-MM-SS.db
```

## 5) Reindex y data hygiene

Reindex completo:
```bash
npm run reindex
```

Reindex incremental:
```bash
npm run reindex -- --since=2026-02-17T00:00:00.000Z --limit=2000
```

Higiene (TTL + dedup + cleanup):
```bash
curl -X POST http://localhost:3000/v1/memory/hygiene/run \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"processedEventsMaxAgeDays":30}'
```

## 6) Indicadores a vigilar

- `GET /v1/ops/memory/metrics`
- `GET /v1/ops/embedding/runtime`
- `GET /v1/ops/automation/health`
- `GET /v1/ops/audit/aggregated`
- `GET /v1/ops/rate-limit/health`

## 6.1) Proxy real + rate limit por actor/ip

Si despliegas detras de Nginx/Cloudflare/ingress:
- `TRUST_PROXY=true` (o hops exactos, por ejemplo `TRUST_PROXY=1`)

Login aplica doble limite:
- por IP: `RATE_LIMIT_AUTH_LOGIN_IP_MAX` en ventana `RATE_LIMIT_AUTH_LOGIN_WINDOW_MS`
- por email: `RATE_LIMIT_AUTH_LOGIN_EMAIL_MAX` en la misma ventana

## 7) Diagnostico rapido del dashboard

- `Unauthorized`: token/cookie invalido o expirado. Re-login en `/login`.
- `Empty`: la vista carga pero los filtros actuales no tienen resultados.
- `No data`: no existe informacion aun (DB limpia o modulo sin uso).

## 8) Reset local seguro

Bash:
```bash
FORCE_RESET=true npm run reset:local
```

PowerShell:
```powershell
$env:FORCE_RESET='true'; npm run reset:local
```

## 9) Rollback por fallo de Google embedding

1. Cambiar a local:
```bash
EMBEDDING_PROVIDER=local npm run dev
```
PowerShell:
```powershell
$env:EMBEDDING_PROVIDER='local'; npm run dev
```

2. Reindex parcial para recuperacion rapida:
```bash
npm run reindex -- --since=2026-02-17T00:00:00.000Z --limit=2000
```

3. Validar drift/runtime:
- `GET /v1/ops/embedding/runtime`
- `GET /v1/ops/memory/metrics`

4. Cuando Google se estabilice, volver a Google y reindex completo:
```bash
EMBEDDING_PROVIDER=google npm run reindex
```
