# Day 4 Checklist - Embeddings + Distributed Rate Limit

## 1) Embedding quality
- [x] Upgraded local embedding algorithm (`semantic-hash-v2`)
- [x] Added semantic alias mapping and richer lexical matching
- [x] Added embedding quality tests

## 2) Embedding backend flexibility
- [x] Added `EMBEDDING_PROVIDER` support (`local` / `google`)
- [x] Added fallback behavior to local embeddings on provider failure
- [x] Stored embedding metadata (`provider/model/version`) in DB
- [x] Exposed runtime pin (`provider/model/version`) in ops endpoint

## 3) Distributed rate limit
- [x] Added SQLite-backed shared limiter table (`rate_limit_buckets`)
- [x] Added backend selection via `RATE_LIMIT_STORE`
- [x] Added test proving counter sharing across two instances
- [x] Added rate-limit health endpoint (active buckets/top blocked/window/evictions)

## 4.1) Observability and drift
- [x] Added embedding drift metrics (`old/new/no-embedding %`)
- [x] Added embedding version distribution metric

## 5) Documentation and operations
- [x] Updated `.env.example` with new flags
- [x] Updated `README` known issues and env docs
- [x] Updated runbook/troubleshooting for Day 4 operation
