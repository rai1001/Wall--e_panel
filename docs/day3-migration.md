# Day 3 Migration Notes (updated through Day 5)

## API compatibility

Backward compatibility is preserved:
- Legacy routes (`/auth`, `/projects`, etc.) are still mounted with deprecation headers.
- Preferred routes remain under `/v1/*`.

## Database migration behavior

Migrations are idempotent and run on startup.
Current hardening includes:
- Column backfill for legacy schemas (including `project_id` paths).
- Safe index creation after column checks.
- Defensive table existence checks before ALTER/INDEX operations.

## Legacy `project_id` blocking issue

Previous failure:
- `SqliteError: no such column: project_id`

Current fix:
- Startup migration now ensures `project_id` in both legacy `memory_items` and legacy `conversations` schemas.
- Additional guard checks reduce startup failures on partially upgraded DBs.

## Real DB upgrade procedure

1. Stop app.
2. Backup DB:
```bash
npm run backup
```
3. Pull latest code.
4. Start app once to run migration:
```bash
npm run dev
```
5. Validate health:
```bash
curl http://localhost:3000/health
```
6. Validate protected endpoint:
```bash
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/v1/memory/search?limit=1"
```

## Rollback procedure

If boot or validation fails:
1. Stop app.
2. Restore backup:
```bash
npm run restore -- --file=backups/<backup-file>.db
```
3. Return to previous stable commit and re-run.

## Environment variables

- `PORT` (default `3000`)
- `DB_PATH` (default `data/assistant.db`)
- `JWT_SECRET` or `JWT_SECRETS`
- `EMBEDDING_PROVIDER` (`google` recommended in production)
- `GOOGLE_API_KEY` (required when provider = `google`)
- `GOOGLE_EMBEDDING_MODEL` (optional)
- `RATE_LIMIT_STORE` (`db` recommended)
- `ALLOW_LEGACY_HEADERS` (optional)
- `FORCE_RESET` for local reset only
