# Troubleshooting

## 1) `SqliteError: no such column: project_id`

Contexto:
- Puede aparecer en BD legacy (por ejemplo tablas `memory_items` o `conversations` antiguas).

Pasos:
1. Deten la app.
2. Haz backup:
```bash
npm run backup
```
3. Arranca con el codigo actual para ejecutar migraciones idempotentes:
```bash
npm run dev
```
4. Si persiste, rollback:
```bash
npm run restore -- --file=backups/<backup-file>.db
```

Nota Day 5:
- La migracion ahora backfillea `project_id` en esquemas legacy de `conversations` y `memory_items`.

## 2) Dashboard: `Unauthorized` vs `Empty` vs `No data`

- `Unauthorized`:
  - Causa: token/cookie ausente o expirado.
  - Fix: abre `http://localhost:3000/login` y vuelve a autenticar.
- `Empty`:
  - Causa: hay filtros activos sin resultados.
  - Fix: limpia filtros de modulo y vuelve a consultar.
- `No data`:
  - Causa: no existe data aun en ese modulo.
  - Fix: crea proyecto/regla/mensaje y refresca.

## 3) `EADDRINUSE` / puerto ocupado

1. Cambia puerto:
```bash
PORT=3001 npm run dev
```
PowerShell:
```powershell
$env:PORT='3001'; npm run dev
```

2. O libera puerto 3000:
```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id <PID> -Force
```

## 4) JWT o DB_PATH mal configurados

Sintomas:
- Login OK pero endpoints protegidos responden 401.
- Datos "desaparecen" por apuntar a otra DB.

Checks:
- Usar `JWT_SECRET` o `JWT_SECRETS` (si rotas, nuevo primero).
- Validar `DB_PATH` correcto y escribible.

## 5) Permisos de SQLite

Sintomas:
- `SQLITE_CANTOPEN` o fallos de escritura.

Fix:
```bash
DB_PATH=./data/assistant.db npm run dev
```
PowerShell:
```powershell
$env:DB_PATH='.\\data\\assistant.db'; npm run dev
```

## 6) Google embeddings con errores/quota

Sintomas:
- Bajas en calidad semantica.
- Latencia alta en `memory/search`.

Checks:
- `EMBEDDING_PROVIDER=google`
- `GOOGLE_API_KEY` valido
- `GOOGLE_EMBEDDING_MODEL` correcto

Fallback operativo:
1. Cambiar a local temporalmente:
```bash
EMBEDDING_PROVIDER=local npm run dev
```
2. Reindex parcial o completo:
```bash
npm run reindex
```
3. Volver a Google cuando se estabilice.

## 7) PowerShell 401 por token vacio

Flujo seguro:
```powershell
$body = @{ email = "rai@local"; password = "alborelle" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/v1/auth/login" -ContentType "application/json" -Body $body
$token = $login.token
$token.Length
Invoke-RestMethod -Uri "http://localhost:3000/v1/auth/me" -Headers @{ Authorization = "Bearer $token" }
```

## 8) Reset local no permitido

Mensaje esperado:
- `Reset bloqueado por seguridad...`

Fix:
```bash
FORCE_RESET=true npm run reset:local
```
PowerShell:
```powershell
$env:FORCE_RESET='true'; npm run reset:local
```

## 9) Rate limit excesivo en login detras de proxy

Sintomas:
- usuarios distintos bloqueados como si fueran la misma IP.

Causa frecuente:
- `TRUST_PROXY` desconfigurado.

Fix:
1. Si hay reverse proxy, activar:
```bash
TRUST_PROXY=true npm run dev
```
PowerShell:
```powershell
$env:TRUST_PROXY='true'; npm run dev
```
2. Ajustar umbrales si hace falta:
- `RATE_LIMIT_AUTH_LOGIN_IP_MAX`
- `RATE_LIMIT_AUTH_LOGIN_EMAIL_MAX`
- `RATE_LIMIT_AUTH_LOGIN_WINDOW_MS`
