# Day 3 Migration Notes

## API compatibility

Backward compatibility is kept:
- Legacy routes (`/auth`, `/projects`, etc.) are still mounted with:
  - `Deprecation: true`
  - `Sunset: Wed, 30 Sep 2026 00:00:00 GMT`
- Recommended routes are under `/v1/*`.

## Main changes

1. Versioning
- New operational prefix: `/v1`.

2. Memory
- `POST /v1/memory/save` supports:
  - `projectId`, `agentId`, `scope`, `memoryType`, `createdBy`, `ttlSeconds`, `temporary`.
- New endpoints:
  - `GET /v1/memory/panel`
  - `POST /v1/memory/reindex`
  - `POST /v1/memory/deduplicate`
  - `POST /v1/memory/hygiene/run`
  - `POST /v1/memory/:id/promote-global`
  - `POST /v1/memory/:id/forget`
  - `POST /v1/memory/:id/block`

3. Ops
- New endpoints:
  - `GET /v1/ops/memory/metrics`
  - `GET /v1/ops/automation/health`
  - `GET /v1/ops/audit/aggregated`

4. Auth/JWT
- JWT rotation via `JWT_SECRETS=secret_new,secret_old`.
- Fallback to `JWT_SECRET` when `JWT_SECRETS` is not defined.

5. Day 4 hardening updates
- `memory_embeddings` now stores `embedding_provider`, `embedding_model`, `embedding_version`.
- New shared limiter table: `rate_limit_buckets` for distributed rate-limit mode.

## Real database migration (blocking path)

Use this flow when upgrading an existing SQLite database.

1. Stop the app.
2. Backup before booting new code:
```bash
npm run backup
```
3. Start the app once so schema migration runs:
```bash
npm run dev
```
4. Validate startup and health:
```bash
curl http://localhost:3000/health
```
5. Validate critical endpoint:
```bash
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/v1/memory/search?limit=1"
```

### If startup fails with `SqliteError: no such column: project_id`

- Root cause in old builds: indexes were created before column backfill.
- Fix in current code: migration now ensures columns first and creates indexes after.
- Recovery steps:
1. Stop app.
2. Restore last backup:
```bash
npm run restore -- --file=backups/<your-backup-file>.db
```
3. Pull latest code with migration fix.
4. Retry startup.

## Rollback plan

If any migration or boot validation fails:
1. Stop app.
2. Restore backup:
```bash
npm run restore -- --file=backups/<your-backup-file>.db
```
3. Revert app version to the previous stable commit.
4. Start old version and verify `/health`.

## Relevant environment variables
- `PORT` (optional, default `3000`)
- `DB_PATH` (optional, default `data/assistant.db`)
- `JWT_SECRETS` (optional, comma-separated)
- `JWT_SECRET` (fallback)
- `EMBEDDING_PROVIDER` (`local` or `openai`)
- `OPENAI_API_KEY` (required for `EMBEDDING_PROVIDER=openai`)
- `OPENAI_EMBEDDING_MODEL` (optional, default `text-embedding-3-small`)
- `RATE_LIMIT_STORE` (`db` recommended, `memory` fallback)
- `ALLOW_LEGACY_HEADERS` (optional, default `false`)
- `FORCE_RESET=true` only for local reset script

## Recommended adoption order
1. Migrate internal clients to `/v1/*`.
2. Run backup policy and periodic reindex.
3. Enable ops monitoring endpoints in daily operation.
