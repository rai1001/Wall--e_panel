# ADR Day 4 - Embeddings and Distributed Rate Limit

Date: 2026-02-17

## Context

Day 3 left two operational gaps:
1. semantic embedding quality was limited to a simple local hash vector.
2. rate limiting was process-local and not shared across app instances.

## Decision

1. Upgrade memory embedding pipeline to `semantic-hash-v2` with:
- improved token normalization and stemming
- concept alias expansion (security, database, automation, etc.)
- weighted token, stem, n-gram, and bigram features
- persisted metadata per embedding (`provider`, `model`, `version`, `dim`)

2. Add optional remote embedding mode:
- `EMBEDDING_PROVIDER=google` + `GOOGLE_API_KEY`
- automatic fallback to local embedding on provider errors

3. Replace in-memory-only rate limiting with backend-selectable limiter:
- `RATE_LIMIT_STORE=db` (default) uses SQLite shared table `rate_limit_buckets`
- `RATE_LIMIT_STORE=memory` keeps local mode for lightweight/dev scenarios

4. Add ops observability for runtime pin and drift:
- active `provider/model/version` exposed in `/v1/ops/embedding/runtime`
- drift and version distribution exposed in `/v1/ops/memory/metrics`
- rate-limit health in `/v1/ops/rate-limit/health`

## Consequences

Positive:
- better semantic retrieval relevance in local mode
- consistent cross-instance rate limits when sharing the same DB
- improved traceability and reindex safety via embedding metadata

Trade-offs:
- `memory/search` now depends on async embedding generation path
- remote embedding mode introduces external latency/cost (mitigated with fallback)
