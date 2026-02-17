# Troubleshooting

## 1) `SqliteError: no such column: project_id`

Cause:
- Old schema plus old migration order.

Fix:
1. Stop app.
2. Backup current DB:
```bash
npm run backup
```
3. Ensure you are on latest code.
4. Start app to run migration:
```bash
npm run dev
```
5. If it still fails, rollback:
```bash
npm run restore -- --file=backups/<backup-file>.db
```

## 2) `EADDRINUSE` / puerto ocupado

Cause:
- Another process is already using `PORT` (default `3000`).

Fix options:
1. Use another port:
```bash
PORT=3001 npm run dev
```
PowerShell:
```powershell
$env:PORT='3001'; npm run dev
```
2. Stop process using port 3000:
```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id <PID> -Force
```

## 3) JWT / DB_PATH mal configurados

Symptoms:
- Login works but protected endpoints fail with `401`.
- App starts with empty data unexpectedly.

Checks:
1. Verify JWT settings:
- Use either `JWT_SECRET` or `JWT_SECRETS`.
- If rotating, put newest key first: `JWT_SECRETS=new_key,old_key`.
2. Verify DB path:
- `DB_PATH` must point to a writable file path.
- If omitted, default is `data/assistant.db`.

## 4) SQLite file permissions

Symptoms:
- `SQLITE_CANTOPEN` or write failures.

Fix:
1. Ensure directory exists and is writable.
2. Avoid read-only folders.
3. Test with local path:
```bash
DB_PATH=./data/assistant.db npm run dev
```
PowerShell:
```powershell
$env:DB_PATH='.\\data\\assistant.db'; npm run dev
```

## 5) Reset script does not run

Symptom:
- `Reset bloqueado por seguridad...`

Fix:
- Set `FORCE_RESET=true` explicitly.

Bash:
```bash
FORCE_RESET=true npm run reset:local
```

PowerShell:
```powershell
$env:FORCE_RESET='true'; npm run reset:local
```

## 6) Embedding provider issues (`EMBEDDING_PROVIDER=google`)

Symptoms:
- Search quality drops suddenly to lexical-only behavior.
- Slow `/v1/memory/search` responses when remote provider is unstable.

Checks:
1. Verify `GOOGLE_API_KEY` is set and valid.
2. Verify outbound access to `https://generativelanguage.googleapis.com`.
3. Confirm model name in `GOOGLE_EMBEDDING_MODEL`.

Notes:
- Current implementation falls back to local embeddings on remote errors.
- Run `npm run reindex` after changing embedding provider/model to keep vectors consistent.

## 7) `401 Se requiere autenticacion` in PowerShell

Common causes:
- `$token` is empty in current terminal session.
- You pasted response lines (for example `HTTP/1.1 ...`) back into PowerShell.
- Login was done against another process/env with different JWT secret.

Safe flow (copy exactly):

```powershell
$body = @{ email = "rai@local"; password = "alborelle" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/v1/auth/login" -ContentType "application/json" -Body $body
$token = $login.token
$token.Length
Invoke-RestMethod -Uri "http://localhost:3000/v1/auth/me" -Headers @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3000/v1/ops/memory/metrics" -Headers @{ Authorization = "Bearer $token" }
```

Browser access without manual headers:
- Open `http://localhost:3000/login`
- Login and continue to dashboard automatically.
